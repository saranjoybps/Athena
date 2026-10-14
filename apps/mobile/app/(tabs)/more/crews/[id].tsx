import { Redirect, useLocalSearchParams } from "expo-router";

export default function EditCrewRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/(tabs)/labour/crews/${id}` as never} />;
}
