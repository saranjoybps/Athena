import { Redirect } from "expo-router";

export default function AccountsRedirect() {
  return <Redirect href={"/(tabs)/more/reports" as never} />;
}
