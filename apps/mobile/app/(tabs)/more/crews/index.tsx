import { Redirect } from "expo-router";

export default function CrewsRedirect() {
  return <Redirect href={"/(tabs)/labour?tab=crews" as never} />;
}
