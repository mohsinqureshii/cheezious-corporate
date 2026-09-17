import Link from 'next/link';

import { AuthShell } from '@/components/account/AuthShell';
import { ForgotPasswordForm } from '@/components/account/ForgotPasswordForm';

export const metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter the address you sign in with and we will send a link to set a new password."
      footer={
        <Link href="/sign-in" className="text-interactive no-underline hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
