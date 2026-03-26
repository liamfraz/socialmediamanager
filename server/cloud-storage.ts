import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadFile(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
): Promise<string> {
  const key = `${crypto.randomUUID()}${path.extname(originalFilename).toLowerCase()}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return getPublicUrl(key);
}

export function getPublicUrl(key: string): string {
  return `${process.env.R2_PUBLIC_URL!}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    }),
  );
}
