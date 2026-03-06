import LoginForm from "./LoginForm";

type AdminLoginPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = params.next?.startsWith("/") ? params.next : "/admin";

  return <LoginForm nextPath={nextPath} />;
}
