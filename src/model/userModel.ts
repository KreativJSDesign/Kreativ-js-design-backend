import mongoose, { Document, Types } from "mongoose";
import bcrypt from "bcryptjs";

interface UserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface AdminUserDocument extends Document, UserMethods {
  username: string;
  password: string;
  _id: Types.ObjectId;
  store_id: string;
  store_name: string;
  email: string;
  owner_name: string;
  access_token: string;
  refresh_token: string;
  client_id: string;
}
const userSchema = new mongoose.Schema<
  AdminUserDocument,
  mongoose.Model<AdminUserDocument>,
  UserMethods
>({
  username: {
    type: String,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  password: {
    type: String,
    minlength: 8,
  },
  store_id: {
    type: String,
  },
  store_name: {
    type: String,
  },
  email: {
    type: String,
  },
  owner_name: {
    type: String,
  },
  access_token: {
    type: String,
  },
  refresh_token: {
    type: String,
  },
});

userSchema.pre<AdminUserDocument>("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (
  this: AdminUserDocument,
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const UserModel = mongoose.model<AdminUserDocument>("AdminUser", userSchema);

export default UserModel;
