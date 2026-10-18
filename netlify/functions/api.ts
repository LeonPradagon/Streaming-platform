import serverless from "serverless-http";
import { createNestApp } from "../../apps/api/src/main";

type ApiHandler = ReturnType<typeof serverless>;

let apiHandler: Promise<ApiHandler> | undefined;

export async function handler(event: any, context: any) {
  apiHandler ??= createNestApp().then((app) => serverless(app.getHttpAdapter().getInstance()));
  return (await apiHandler)(event, context);
}
