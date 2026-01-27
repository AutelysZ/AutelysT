import { ToolPageWrapper } from "@/components/tool-ui/tool-page-wrapper";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AWS Encryption SDK - AutelysT",
  description:
    "Encrypt and decrypt data using AWS Encryption SDK with Raw AES and RSA keyrings.",
};

export default function AwsEncryptionSdkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToolPageWrapper
      toolId="aws-encryption-sdk"
      title="AWS Encryption SDK"
      description="Encrypt and decrypt data using AWS Encryption SDK with Raw AES and RSA keyrings"
      historyVariant="aws-encryption-sdk"
    >
      {children}
    </ToolPageWrapper>
  );
}
