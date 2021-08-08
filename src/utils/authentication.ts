import { FastifyRequest, FastifyReply } from "fastify"
import { RouteGenericInterface } from "fastify/types/route"
import AuthModel from "../database/fagc/authentication"
import CommunityModel from "../database/fagc/community"

const Authenticate = <T extends RouteGenericInterface = RouteGenericInterface>(
	_target: unknown,
	_propertyKey: unknown,
	descriptor: TypedPropertyDescriptor<(
		req: FastifyRequest<T>,
		res: FastifyReply,
	) => Promise<FastifyReply>>,
): TypedPropertyDescriptor<(
	req: FastifyRequest<T>,
	res: FastifyReply,
) => Promise<FastifyReply>> => {
	const originalRoute = descriptor.value
	if (!originalRoute) return descriptor
	descriptor.value = async (...args) => {
		const [req, res] = args
		// return originalRoute.apply(this, args)
		const auth = req.headers["authorization"]
		if (!auth) return res.status(401).send({
			statusCode: 401,
			error: "Unauthorized",
			message: "Your API key was invalid"
		})
		if (auth.startsWith("Token ")) {
			const token = auth.slice("Token ".length)
			const authData = await AuthModel.findOne({ api_key: token })
			const community = await CommunityModel.findOne({ _id: authData?.communityId })
			if (!community) return res.status(401).send({
				statusCode: 401,
				error: "Unauthorized",
				message: "Your API key was invalid"
			})
			req.requestContext.set("community", community)
			return originalRoute.apply(this, args)
		}
		// else if (auth.startsWith("Bearer ")) {
		// 	// Bearer auth from users or something
		// }
		return res.status(401).send({
			statusCode: 401,
			error: "Unauthorized",
			message: "Your API key was invalid"
		})
	}
	return descriptor
}
export default Authenticate