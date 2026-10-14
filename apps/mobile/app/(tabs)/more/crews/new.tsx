import { Redirect } from "expo-router";

export default function NewCrewRedirect() {
  return <Redirect href={"/(tabs)/labour/crews/new" as never} />;
}
