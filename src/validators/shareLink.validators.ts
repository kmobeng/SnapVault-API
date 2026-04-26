import { z } from "zod";

export const shareLinkCreateSchema = z.object({
	expiresIn: z
		.enum(["1d", "7d", "30d", "never"], {
			message: "expiresIn must be one of: 1d, 7d, 30d, never",
		})
		.default("7d"),
});
