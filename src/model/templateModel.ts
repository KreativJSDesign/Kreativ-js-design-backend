import mongoose, { Document, Types } from "mongoose";

export interface TemplateDocument extends Document {
  stickerUrl: string;
  backgroundUrl: string;
  productId: string[];
  _id: Types.ObjectId;
}

const templateSchema = new mongoose.Schema<TemplateDocument>(
  {
    backgroundUrl: {
      type: String,
      required: true,
    },
    stickerUrl: {
      type: String,
      required: true,
    },
    productId: { type: [String], default: [] },
  },
  { timestamps: true },
);

const TemplateModel = mongoose.model<TemplateDocument>(
  "Template",
  templateSchema,
);

export default TemplateModel;
