import mongoose, { Document, Schema, model, Types } from "mongoose";

// Define an interface for the card sections (cardBody & cardHeader)
interface CardSection {
  text?: string;
  fontStyle?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlignment?: string;
  fontColor?: string;
}

// Define the document interface for TypeScript
export interface TransactionDocument extends Document {
  transaction_id: number;
  listing_id: number;
  customerEmail: string;
  templateId: string;
  lastDate: Date;
  _id: Types.ObjectId;
  complete: boolean;
  cardBody?: CardSection;
  cardHeader?: CardSection;
  cardViewUrl: string;
}

const TransactionSchema = new mongoose.Schema<TransactionDocument>(
  {
    transaction_id: {
      type: Number,
      index: true,
    },
    listing_id: {
      type: Number,
    },
    customerEmail: {
      type: String,
    },
    lastDate: {
      type: Date,
      required: true,
    },
    complete: {
      type: Boolean,
    },
    cardViewUrl: {
      type: String,
    },
    templateId: {
      type: String,
    },
    cardBody: {
      text: { type: String },
      fontStyle: { type: String },
      fontSize: { type: String },
      fontWeight: { type: String },
      textAlignment: { type: String },
      fontColor: { type: String },
    },
    cardHeader: {
      text: { type: String },
      fontStyle: { type: String },
      fontSize: { type: String },
      fontWeight: { type: String },
      textAlignment: { type: String },
      fontColor: { type: String },
    },
  },
  { timestamps: true },
);

const TransactionModel = model<TransactionDocument>(
  "transaction",
  TransactionSchema,
);

export default TransactionModel;
