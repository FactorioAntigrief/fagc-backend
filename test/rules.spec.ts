import RuleModel from "../src/database/fagc/rule"
import backend from "./prepareTest.js"

describe("Rules", () => {
	it("Should fetch all rules", async () => {
		const fetchedData = await RuleModel.find({})
		const response = await backend.inject({
			path: "/rules",
			method: "GET"
		})
		expect(response.statusCode).toBe(200)
		const backendData = await response.json()
		expect(backendData.length).toBe(fetchedData.length)
		fetchedData.map((fetchedRule, i) => {
			const backendRule = backendData[i]
			expect(backendRule).not.toBeNull()
			expect(backendRule.id).toBe(fetchedRule.id)
			expect(backendRule.shortdesc).toBe(fetchedRule.shortdesc)
			expect(backendRule.longdesc).toBe(fetchedRule.longdesc)
		})
	})
})