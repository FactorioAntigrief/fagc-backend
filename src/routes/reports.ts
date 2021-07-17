// import express from "express"
// import ReportModel from "../database/fagc/report"
// import RevocationModel from "../database/fagc/revocation"
// import RuleModel from "../database/fagc/rule"
// import { validateUserString } from "../utils/functions-databaseless"
// import { getCommunity, checkUser } from "../utils/functions"
// import { reportCreatedMessage, reportRevokedMessage } from "../utils/info"

// const router = express.Router()

// router.get("/getall", async (req, res) => {
// 	if (req.query.playername === undefined || typeof (req.query.playername) !== "string")
// 		return res.status(400).json({ error: "Bad Request", description: `playername expected string, got ${typeof (req.query.playername)} with value of ${req.query.playername}` })
// 	const dbRes = await ReportModel.find({
// 		playername: req.query.playername
// 	}).populate("reports")
// 	res.status(200).json(dbRes)
// })
// router.get("/getbyid", async (req, res) => {
// 	if (req.query.id === undefined || !validateUserString(req.query.id))
// 		return res.status(400).json({ error: "Bad Request", description: `id expected ID, got ${typeof (req.query.id)} with value of ${req.query.id}` })
// 	const dbRes = await ReportModel.findOne({ id: req.query.id })
// 	res.status(200).json(dbRes)
// })
// router.get("/getbyrule", async (req, res) => {
// 	if (!req.query.id || !validateUserString(req.query.id))
// 		return res.status(400).json({ error: "Bad Request", description: `id must be ID, got ${req.query.id}` })
// 	const reports = await ReportModel.find({
// 		brokenRule: req.query.id
// 	})
// 	res.status(200).json(reports)
// })

// router.post("/create", async (req, res) => {
// 	if (Array.isArray(req.headers["authorization"])) return
// 	if (req.body.playername === undefined || typeof (req.body.playername) !== "string" || !req.body.playername.length)
// 		return res.status(400).json({ error: "Bad Request", description: `playername expected string, got ${typeof (req.body.playername)} with value of ${req.body.playername}` })
// 	if (req.body.adminId === undefined || typeof (req.body.adminId) !== "string" || !req.body.adminId.length)
// 		return res.status(400).json({ error: "Bad Request", description: `adminId expected string, got ${typeof (req.body.adminId)} with value of ${req.body.adminId}` })
// 	if (req.body.brokenRule === undefined || !validateUserString(req.body.brokenRule))
// 		return res.status(400).json({ error: "Bad Request", description: `brokenRule expected ID, got ${typeof (req.body.brokenRule)} with value of ${req.body.brokenRule}` })
// 	if (req.body.automated === undefined || typeof (req.body.automated) !== "string")
// 		req.body.automated = "false"
// 	const isUser = await checkUser(req.body.adminId) // this is later as it takes a bit
// 	if (!isUser)
// 		return res.status(400).json({ error: "Bad Request", description: `adminId expected Discord user ID, got ${req.body.adminId} which is not one` })

// 	try {
// 		const rule = await RuleModel.findOne({ id: req.body.brokenRule })
// 		if (!rule) throw "Wrong rule"
// 	} catch (error) {
// 		return res.status(400).json({ error: "Bad Request", description: "Rule must be a RuleID" })
// 	}
// 	const community = await getCommunity(req.headers["authorization"])
// 	if (!community) return res.status(400).json({error: "Bad Request", description: "apikey does not match a community"})
// 	const report = await ReportModel.create({
// 		playername: req.body.playername,
// 		communityId: community.id,
// 		brokenRule: req.body.brokenRule,
// 		proof: req.body.proof || "None",
// 		description: req.body.description || "None",
// 		automated: req.body.automated.toLowerCase() === "true" ? true : false,
// 		reportedTime: Date.parse(req.body.reportedTime) || new Date(),
// 		adminId: req.body.adminId
// 	})
// 	let msg = report.toObject()
// 	reportCreatedMessage(msg)
// 	return res.status(200).json(msg)
// })
// router.delete("/revoke", async (req, res) => {
// 	if (Array.isArray(req.headers["authorization"])) return
// 	if (req.body.id === undefined || !validateUserString(req.body.id))
// 		return res.status(400).json({ error: "Bad Request", description: `id expected ID, got ${typeof (req.body.id)} with value of ${req.body.id}` })
// 	if (req.body.adminId === undefined || typeof (req.body.adminId) !== "string")
// 		return res.status(400).json({ error: "Bad Request", description: `adminId expected string, got ${typeof (req.body.adminId)} with value of ${req.body.adminId}` })
// 	const isUser = await checkUser(req.body.adminId)
// 	if (!isUser)
// 		return res.status(400).json({ error: "Bad Request", description: `adminId expected Discord user ID, got ${req.body.adminId} which is not one` })

// 	const community = await getCommunity(req.headers["authorization"])
// 	if (!community) return res.status(400).json({error: "Bad Request", description: "apikey does not match a community"})
// 	const toRevoke = await ReportModel.findOne({ id: req.body.id })
// 	if (toRevoke === undefined || toRevoke === null)
// 		return res.status(404).json({ error: "Not Found", description: `Report with ID ${req.body.id} not found` })
// 	if (!toRevoke.communityId == community.id)
// 		return res.status(403).json({ error: "Access Denied", description: `You are trying to access a report of community ${toRevoke.communityId} but your community ID is ${community.id}` })

// 	const report = await ReportModel.findByIdAndDelete(toRevoke._id)
// 	if (!report) return res.status(400).json({error: "Bad Request", message: `report with ID ${toRevoke._id} not found`})
// 	let revocation = await RevocationModel.create({
// 		reportId: report.id,
// 		playername: report.playername,
// 		communityId: report.communityId,
// 		adminId: report.adminId,
// 		brokenRule: report.brokenRule,
// 		proof: report.proof,
// 		description: report.description,
// 		automated: report.automated,
// 		reportedTime: report.reportedTime,
// 		revokedTime: new Date(),
// 		revokedBy: req.body.adminId
// 	})
// 	let msg = revocation.toObject()
// 	reportRevokedMessage(msg)
// 	res.status(200).json(msg)
// })
// router.delete("/revokeallname", async (req, res) => {
// 	if (Array.isArray(req.headers["authorization"])) return
// 	if (req.body.adminId === undefined || typeof (req.body.adminId) !== "string")
// 		return res.status(400).json({ error: "Bad Request", description: `adminId expected string, got ${typeof (req.body.adminId)} with value of ${req.body.adminId}` })
// 	if (req.body.playername === undefined || typeof (req.body.playername) !== "string")
// 		return res.status(400).json({ error: "Bad Request", description: `playername expected string, got ${typeof (req.body.playername)} with value of ${req.body.playername}` })
// 	const isUser = await checkUser(req.body.adminId)
// 	if (!isUser)
// 		return res.status(400).json({ error: "Bad Request", description: `adminId expected Discord user ID, got ${req.body.adminId} which is not one` })

// 	const community = await getCommunity(req.headers["authorization"])
// 	if (!community) return res.status(400).json({error: "Bad Request", description: "apikey does not match a community"})
// 	const toRevoke = await ReportModel.find({
// 		playername: req.body.playername,
// 		communityId: community.id
// 	})
// 	if (!toRevoke || !toRevoke[0])
// 		return res.status(404).json({ error: "Not Found", description: `Profile with player name ${req.body.playername} not found` })
// 	if (toRevoke[0].communityId != community.id)
// 		return res.status(403).json({ error: "Access Denied", description: `You are trying to access a profile of community ${toRevoke[0].communityId} but your community ID is ${community.id}` })

// 	const revocations = await Promise.all(toRevoke.map(async (report) => {
// 		await ReportModel.findByIdAndDelete(report._id)
// 		const revocation = await RevocationModel.create({
// 			reportId: report.id,
// 			playername: report.playername,
// 			communityId: report.communityId,
// 			adminId: report.adminId,
// 			brokenRule: report.brokenRule,
// 			proof: report.proof,
// 			description: report.description,
// 			automated: report.automated,
// 			reportedTime: report.reportedTime,
// 			revokedTime: new Date(),
// 			revokedBy: req.body.adminId
// 		})
// 		reportRevokedMessage(revocation.toObject())
// 		return revocation
// 	}))
// 	res.status(200).json(revocations)
// })

// export default router

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from "@sinclair/typebox"
import DiscordClient from "../utils/discord"
import { validateUserString } from "../utils/functions-databaseless"
import ReportModel from "../database/fagc/report"
import RevocationModel from "../database/fagc/revocation"
import RuleModel from "../database/fagc/rule"
import { CreateReport } from "fagc-api-types"

const yupOptions = {
	strict: false,
	abortEarly: false, // return all errors
	stripUnknown: true, // remove additional properties
	recursive: true
}

export default function (fastify: FastifyInstance, opts, next) {
	fastify.get<{
		Params: {
			id: string
		}
	}>("/:id", {
		schema: {
			params: Type.Required(Type.Object({
				id: Type.String()
			}))
		},
		validatorCompiler: ({ schema }: { schema: any }) => {
			return (data) => {
				try {
					const result = schema.validateSync(data, yupOptions)
					return { value: result }
				} catch (e) {
					return { error: e }
				}
			}
		}
	}, async (req, res) => {
		const { id } = req.params

		const rule = await ReportModel.findOne({ id: id })
		return res.send(rule)
	})

	fastify.post<{
		Body: CreateReport
	}>("/", {
		schema: {
			body: Type.Object({
				playername: Type.String(),
				adminId: Type.RegEx(/\d{13,}/g),
				proof: Type.Optional(Type.String()),
				description: Type.Optional(Type.String()),
				automated: Type.Optional(Type.Boolean()),
				reportedTime: Type.Optional(Type.Integer()),
			})
		},
	}, async (req, res) => {
		const {
			playername,
			adminId,
			proof,
			description,
			automated,
			reportedTime
		} = req.body

		const report = await ReportModel.create({
			playername: playername,
			adminId: adminId,
			proof: proof || "None",
			description: description || "None",
			automated: automated !== undefined ? automated : false,
			reportedTime: new Date(reportedTime || Date.now()),
		})
		console.log(report)

		res.send(report)
	})
	next()
}