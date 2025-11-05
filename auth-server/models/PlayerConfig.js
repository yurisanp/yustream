const mongoose = require("mongoose");

const playerConfigSchema = new mongoose.Schema(
	{
		videoId: {
			type: String,
			required: [true, "ID do vídeo é obrigatório"],
			trim: true,
		},
		updatedBy: {
			type: String,
			default: null,
			trim: true,
		},
	},
	{
		timestamps: true,
		versionKey: false,
	}
);

playerConfigSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("PlayerConfig", playerConfigSchema);

