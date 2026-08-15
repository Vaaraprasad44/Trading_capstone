import { bannerFrom, getBriefing } from "@/app/briefing/data";
import Dashboard from "./Dashboard";

export default async function DashboardPage() {
  const briefing = await getBriefing();
  return <Dashboard banner={bannerFrom(briefing)} />;
}
