import { FastifyReply, FastifyRequest } from "fastify"
import { Controller, DELETE, GET, POST } from "fastify-decorators"

import RuleModel from "../database/fagc/rule.js"
import { Authenticate, MasterAuthenticate } from "../utils/authentication.js"
import CommunityModel from "../database/fagc/community.js"
import GuildConfigModel from "../database/fagc/guildconfig.js"
import {
	guildConfigChanged,
	communityCreatedMessage,
	communityRemovedMessage,
	communityUpdatedMessage,
	communitiesMergedMessage,
} from "../utils/info.js"
import {
	client,
	validateDiscordGuild,
	validateDiscordUser,
} from "../utils/discord.js"
import ReportModel from "../database/fagc/report.js"
import RevocationModel from "../database/fagc/revocation.js"
import WebhookModel from "../database/fagc/webhook.js"
import AuthModel from "../database/fagc/authentication.js"
// import cryptoRandomString from "crypto-random-string"
import { CommunityCreatedMessageExtraOpts } from "fagc-api-types"
import { z } from "zod"

@Controller({ route: "/communities" })
export default class CommunityController {
	@GET({
		url: "/",
		options: {
			schema: {
				tags: [ "community" ],
				response: {
					"200": {
						type: "array",
						items: {
							$ref: "CommunityClass#",
						},
					},
				},
			},
		},
	})
	async getAllCommunities(
		req: FastifyRequest,
		res: FastifyReply
	): Promise<FastifyReply> {
		const communities = await CommunityModel.find({})
		return res.send(communities)
	}

	@GET({
		url: "/:id",
		options: {
			schema: {
				params: z.object({
					id: z.string().transform(x => x.toLowerCase()),
				}),

				tags: [ "community" ],
				response: {
					"200": {
						allOf: [
							{ nullable: true },
							{ $ref: "CommunityClass#" },
						],
					},
				},
			},
		},
	})
	async getCommunity(
		req: FastifyRequest<{
			Params: {
				id: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { id } = req.params
		const community = await CommunityModel.findOne({ id: id })
		return res.send(community)
	}

	@GET({
		url: "/getown",
		options: {
			schema: {
				tags: [ "community" ],
				security: [
					{
						authorization: [],
					},
				],
				response: {
					"200": {
						allOf: [
							{ nullable: true },
							{ $ref: "CommunityClass#" },
						],
					},
				},
			},
		},
	})
	@Authenticate
	async getOwnCommunity(
		req: FastifyRequest,
		res: FastifyReply
	): Promise<FastifyReply> {
		const community = req.requestContext.get("community")
		return res.send(community)
	}

	@GET({
		url: "/guildconfig/:guildId",
		options: {
			schema: {
				params: z.object({
					guildId: z.string()
				}),

				tags: [ "community" ],
				response: {
					"200": {
						allOf: [
							{ nullable: true },
							{ $ref: "GuildConfigClass#" },
						],
					},
				},
			},
		},
	})
	async getGuildConfig(
		req: FastifyRequest<{
			Params: {
				guildId: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { guildId } = req.params
		const config = await GuildConfigModel.findOne({ guildId: guildId })
		return res.send(config)
	}

	@POST({
		url: "/guildconfig/:guildId",
		options: {
			schema: {
				params: z.object({
					guildId: z.string()
				}),
				body: z.object({
					ruleFilters: z.array(z.string()).optional().transform(x => x ? x.map(y => y.toLowerCase()) : x),
					trustedCommunities: z.array(z.string()).optional().transform(x => x ? x.map(y => y.toLowerCase()) : x),
					roles: z.object({
						reports: z.string().optional(),
						webhooks: z.string().optional(),
						setConfig: z.string().optional(),
						setRules: z.string().optional(),
						setCommunities: z.string().optional(),
					}).optional()
				}),

				tags: [ "community" ],
				security: [
					{
						authorization: [],
					},
				],
				response: {
					"200": {
						allOf: [
							{ nullable: true },
							{ $ref: "GuildConfigClass#" },
						],
					},
				},
			},
		},
	})
	@Authenticate
	async setGuildConfig(
		req: FastifyRequest<{
			Params: {
				guildId: string
			}
			Body: {
				ruleFilters?: string[]
				trustedCommunities?: string[]
				roles?: {
					reports?: string
					webhooks?: string
					setConfig?: string
					setRules?: string
					setCommunities?: string
				}
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { ruleFilters, trustedCommunities, roles } = req.body
		const { guildId } = req.params

		// query database if rules and communities actually exist
		if (ruleFilters) {
			const rulesExist = await RuleModel.find({
				id: { $in: ruleFilters },
			})
			if (rulesExist.length !== ruleFilters.length)
				return res.status(400).send({
					errorCode: 400,
					error: "Bad Request",
					message: `ruleFilters must be array of IDs of rules, got ${ruleFilters.toString()}, some of which are not real rule IDs`,
				})
		}
		if (trustedCommunities) {
			const communitiesExist = await CommunityModel.find({
				id: { $in: trustedCommunities },
			})
			if (communitiesExist.length !== trustedCommunities.length)
				return res.status(400).send({
					errorCode: 400,
					error: "Bad Request",
					message: `trustedCommunities must be array of IDs of communities, got ${trustedCommunities.toString()}, some of which are not real community IDs`,
				})
		}

		// check other stuff

		const community = req.requestContext.get("community")
		if (!community)
			return res.status(400).send({
				errorCode: 400,
				error: "Not Found",
				message: "Community config was not found",
			})
		// check if guild exists
		if (!client.guilds.resolve(guildId)) {
			return res.status(400).send({
				errorCode: 400,
				error: "Not Found",
				message: "Guild was not found",
			})
		}

		const guildConfig = await GuildConfigModel.findOne({
			communityId: community.id,
			guildId: guildId,
		})

		if (!guildConfig)
			return res.status(400).send({
				errorCode: 400,
				error: "Not Found",
				message: "Community config was not found",
			})

		if (ruleFilters) guildConfig.ruleFilters = ruleFilters
		if (trustedCommunities)
			guildConfig.trustedCommunities = trustedCommunities

		const findRole = (id: string) => {
			const guildRoles = client.guilds.cache
				.map((guild) => guild.roles.resolve(id))
				.filter((r) => r && r.id)
			return guildRoles[0]
		}

		if (!guildConfig.roles)
			guildConfig.roles = {
				reports: "",
				webhooks: "",
				setConfig: "",
				setRules: "",
				setCommunities: "",
			}
		if (roles) {
			Object.keys(roles).map((roleType) => {
				const role = findRole(roles[roleType])
				if (role) guildConfig.roles[roleType] = role.id
			})
		}

		await GuildConfigModel.findOneAndReplace(
			{
				guildId: guildConfig.guildId,
			},
			guildConfig.toObject()
		)

		guildConfig.set("apikey", null)
		guildConfigChanged(guildConfig)
		return res.status(200).send(guildConfig)
	}

	@POST({
		url: "/communityconfig",
		options: {
			schema: {
				body: z.object({
					contact: z.string().optional(),
					name: z.string().optional()
				}),

				tags: [ "community" ],
				security: [
					{
						authorization: [],
					},
				],
				response: {
					"200": {
						allOf: [
							{ nullable: true },
							{ $ref: "CommunityClass#" },
						],
					},
				},
			},
		},
	})
	@Authenticate
	async setCommunityConfig(
		req: FastifyRequest<{
			Body: {
				contact?: string
				name?: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { contact, name } = req.body

		const community = req.requestContext.get("community")
		if (!community)
			return res.status(400).send({
				errorCode: 400,
				error: "Not Found",
				message: "Community config was not found",
			})

		const contactUser = await validateDiscordUser(contact || "")
		if (contact && !contactUser)
			return res.status(400).send({
				errorCode: 400,
				error: "Bad Request",
				message: `contact must be Discord User snowflake, got value ${contact}, which isn't a known Discord user`,
			})

		community.name = name || community.name
		community.contact = contact || community.contact

		await CommunityModel.findOneAndReplace(
			{
				id: community.id,
			},
			community.toObject()
		)

		communityUpdatedMessage(community, {
			contact: <CommunityCreatedMessageExtraOpts["contact"]>(
				(<unknown>contactUser)
			)
		})

		return res.status(200).send(community)
	}

	@POST({
		url: "/notifyGuildConfigChanged/:guildId",
		options: {
			schema: {
				params: z.object({
					guildId: z.string()
				}),

				security: [
					{
						masterAuthorization: [],
					},
				],
			},
		},
	})
	@MasterAuthenticate
	async notifyGuildConfigChanged(
		req: FastifyRequest<{
			Params: {
				guildId: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { guildId } = req.params
		const guildConfig = await GuildConfigModel.findOne({
			guildId: guildId,
		})

		if (!guildConfig)
			return res.status(404).send({
				errorCode: 404,
				error: "Guild config not found",
				message: `Guild config for guild ${guildId} was not found`,
			})

		guildConfig.set("apikey", null)
		guildConfigChanged(guildConfig)

		return res.send({ status: "ok" })
	}

	@POST({
		url: "/",
		options: {
			schema: {
				body: z.object({
					name: z.string(),
					contact: z.string(),
					guildId: z.string().optional(),
				}),

				description: "Create a FAGC community",
				tags: [ "community", "master" ],
				security: [
					{
						masterAuthorization: [],
					},
				],
				response: {
					"200": {
						type: "object",
						properties: {
							apiKey: { type: "string" },
							community: {
								$ref: "CommunityClass#",
							},
						},
					},
				},
			},
		},
	})
	@MasterAuthenticate
	async createCommunity(
		req: FastifyRequest<{
			Body: {
				name: string
				contact: string
				guildId?: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { name, contact, guildId } = req.body

		const validDiscordUser = await validateDiscordUser(contact)
		if (!validDiscordUser)
			return res.status(400).send({
				errorCode: 400,
				error: "Invalid Discord User",
				message: `${contact} is not a valid Discord user`,
			})
		if (validDiscordUser.bot) {
			return res.status(400).send({
				errorCode: 400,
				error: "Invalid Discord User",
				message: `${contact} is a bot`,
			})
		}
		const validGuild = guildId ? await validateDiscordGuild(guildId) : true
		if (!validGuild)
			return res.status(400).send({
				errorCode: 400,
				error: "Invalid Guild",
				message: `${guildId} is not a valid Discord guild`,
			})

		const community = await CommunityModel.create({
			name: name,
			contact: contact,
			guildIds: guildId ? [ guildId ] : [],
		})

		if (guildId) {
			// update community config to have communityId if guild exists
			await GuildConfigModel.updateMany(
				{ guildId: guildId },
				{
					$set: { communityId: community.id },
				}
			)
		}

		const auth = await AuthModel.create({
			communityId: community.id,
			// api_key: cryptoRandomString({ length: 64 }),
			api_key: "xxxx"
		})

		const contactUser = await client.users.fetch(contact)

		communityCreatedMessage(community, {
			contact: <CommunityCreatedMessageExtraOpts["contact"]>(
				(<unknown>contactUser)
			),
		})

		return res.send({
			community: community,
			apiKey: auth.api_key,
		})
	}

	@DELETE({
		url: "/:communityId",
		options: {
			schema: {
				params: z.object({
					communityId: z.string().transform(x => x.toLowerCase()),
				}),

				description: "Delete a FAGC community",
				tags: [ "community", "master" ],
				security: [
					{
						masterAuthorization: [],
					},
				],
				response: {
					"200": {
						type: "boolean",
					},
				},
			},
		},
	})
	@MasterAuthenticate
	async removeCommunity(
		req: FastifyRequest<{
			Params: {
				communityId: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { communityId } = req.params

		const community = await CommunityModel.findOneAndDelete({
			id: communityId,
		})
		if (!community)
			return res.status(404).send({
				errorCode: 404,
				error: "Not found",
				message: `Community with ID ${communityId} was not found`,
			})

		const guildConfigs = await GuildConfigModel.find({
			communityId: community.id,
		})
		await GuildConfigModel.deleteMany({
			communityId: community.id,
		})

		await ReportModel.deleteMany({
			communityId: community.id,
		})
		await RevocationModel.deleteMany({
			communityId: community.id,
		})
		await AuthModel.findOneAndDelete({
			communityId: community.id,
		})
		if (guildConfigs) {
			await WebhookModel.deleteMany({
				guildId: { $in: guildConfigs.map(config => config.guildId) },
			})
		}

		// remove the community ID from any guild configs which may have it
		const affectedGuildConfigs = await GuildConfigModel.find({
			trustedCommunities: [ community.id ]
		})
		await GuildConfigModel.updateMany({
			_id: { $in: affectedGuildConfigs.map(config => config._id) }
		}, {
			$pull: { trustedCommunities: community.id }
		})
		const newGuildConfigs = await GuildConfigModel.find({
			_id: { $in: affectedGuildConfigs.map(config => config._id) }
		})

		const sendGuildConfigInfo = async () => {
			const wait = (ms: number): Promise<void> => new Promise((resolve) => {
				setTimeout(() => {
					resolve()
				}, ms)
			})
			for (const config of newGuildConfigs) {
				guildConfigChanged(config)
				// 1000 * 100 / 1000 = amount of seconds it will take for 100 communities
				// staggered so not everyone at once tries to fetch their new banlists
				await wait(100)
			}
		}
		sendGuildConfigInfo() // this will make it execute whilst letting other code still run

		const contactUser = await client.users.fetch(community.contact)
		communityRemovedMessage(community, {
			contact: <CommunityCreatedMessageExtraOpts["contact"]>(
				(<unknown>contactUser)
			),
		})

		return res.send(true)
	}

	@POST({
		url: "/:idReceiving/merge/:idDissolving",
		options: {
			schema: {
				params: z.object({
					idReceiving: z.string().transform(x => x.toLowerCase()),
					idDissolving: z.string().transform(x => x.toLowerCase()),
				}),

				description: "Merge community idDissolving into community idReceiving",
				tags: [ "communities" ],
				security: [
					{
						masterAuthorization: [],
					},
				],
				response: {
					"200": {
						$ref: "CommunityClass#",
					},
				},
			},
		},
	})
	@MasterAuthenticate
	async mergeCommunities(
		req: FastifyRequest<{
			Params: {
				idReceiving: string
				idDissolving: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { idReceiving, idDissolving } = req.params
		const receiving = await CommunityModel.findOne({
			id: idReceiving
		})
		if (!receiving)
			return res.status(400).send({
				errorCode: 400,
				error: "Bad Request",
				message: "idOne must be a valid community ID",
			})
		const dissolving = await CommunityModel.findOne({
			id: idDissolving
		})
		if (!dissolving)
			return res.status(400).send({
				errorCode: 400,
				error: "Bad Request",
				message: "idTwo must be a valid community ID",
			})


		await CommunityModel.findOneAndDelete({
			id: idDissolving
		})
		await ReportModel.updateMany({
			communityId: idDissolving
		}, {
			communityId: idReceiving
		})
		await RevocationModel.updateMany({
			communityId: idDissolving
		}, {
			communityId: idReceiving
		})
		
		// remove old stuff from the config and replace with new
		await GuildConfigModel.updateMany({
			trustedCommunities: idDissolving
		}, {
			$addToSet: { trustedCommunities: idReceiving }
		})
		await GuildConfigModel.updateMany({
			trustedCommunities: idDissolving,
		}, {
			$pull: { trustedCommunities: idDissolving },
		})

		const guildConfigs = await GuildConfigModel.find({
			communityId: { $in: [ idReceiving, idDissolving ] }
		})

		// change configs + remove old auth
		await CommunityModel.updateOne({
			id: idReceiving
		}, {
			$addToSet: { guildIds:  guildConfigs.map(config => config.guildId) }
		})
		await GuildConfigModel.updateMany({
			communityId: idDissolving
		}, {
			communityId: idReceiving,
			apikey: guildConfigs.find(c => c.communityId === idReceiving)?.apikey || undefined,
		})
		await AuthModel.deleteMany({
			communityId: idDissolving
		})

		const affectedConfigs = await GuildConfigModel.find({
			trustedCommunities: idReceiving
		})

		const sendGuildConfigInfo = async () => {
			const wait = (ms: number): Promise<void> => new Promise((resolve) => {
				setTimeout(() => {
					resolve()
				}, ms)
			})
			for (const config of affectedConfigs) {
				guildConfigChanged(config)
				// 1000 * 100 / 1000 = amount of seconds it will take for 100 communities
				// staggered so not everyone at once tries to fetch their new banlists
				await wait(100)
			}
		}
		sendGuildConfigInfo() // this will make it execute whilst letting other code still run

		const contactUser = await validateDiscordUser(receiving.contact)

		communitiesMergedMessage(receiving, dissolving, {
			contact: <CommunityCreatedMessageExtraOpts["contact"]>(
				(<unknown>contactUser)
			)
		})

		return res.send(receiving)
	}

	@POST({
		url: "/guildLeave/:guildId",
		options: {
			schema: {
				params: z.object({
					guildId: z.string(),
				}),

				description: "Delete a FAGC community",
				tags: [ "community", "master" ],
				security: [
					{
						masterAuthorization: [],
					},
				],
			},
		},
	})
	@MasterAuthenticate
	async guildLeave(
		req: FastifyRequest<{
			Params: {
				guildId: string
			}
		}>,
		res: FastifyReply
	): Promise<FastifyReply> {
		const { guildId } = req.params

		await WebhookModel.deleteMany({
			guildId: guildId,
		})
		await GuildConfigModel.deleteMany({
			guildId: guildId,
		})
		const communityConfig = await CommunityModel.findOne({
			guildIDs: [ guildId ],
		})
		if (communityConfig) {
			communityConfig.guildIds = communityConfig.guildIds.filter(
				(id) => id !== guildId
			)
			await communityConfig.save()
		}

		return res.status(200).send({ status: "ok" })
	}
}
