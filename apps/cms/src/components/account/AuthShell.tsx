import Link from 'next/link';

/**
 * The frame shared by the signed-out screens.
 *
 * Same identity panel as sign-in, so a password reset does not feel like it has
 * left the building. Nothing here is a marketing surface: this is an internal
 * tool and it should read like one.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-2/5 flex-col justify-between bg-gray-100 p-09 lg:flex">
        <div className="flex items-baseline gap-02">
          <span className="text-heading-03 font-semibold text-content-inverse">Cheezious</span>
          <span className="text-label-01 uppercase tracking-wide text-gray-50">CMS</span>
        </div>
        <p className="text-helper-01 text-gray-50">Authorised access only. Activity is logged.</p>
      </div>

      <div className="flex w-full items-center justify-center bg-surface-subtle p-05 lg:w-3/5">
        <div className="w-full max-w-sm">
          <div className="mb-07 lg:hidden">
            <span className="text-heading-03 font-semibold text-content-primary">Cheezious</span>
            <span className="ms-02 text-label-01 uppercase tracking-wide text-content-tertiary">CMS</span>
          </div>

          <h1 className="text-heading-04 text-content-primary">{title}</h1>
          {description ? <p className="mt-02 text-body-01 text-content-secondary">{description}</p> : null}

          <div className="mt-06">{children}</div>

          <p className="mt-07 text-body-compact">
            {footer ?? (
              <Link href="/sign-in" className="text-interactive no-underline hover:underline">
                Back to sign in
              </Link>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
