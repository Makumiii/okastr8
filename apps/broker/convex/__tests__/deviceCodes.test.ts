import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

test("device code flow", async () => {
  // @ts-ignore
  const t = convexTest(schema, import.meta.glob("../**/*.ts"));


  // 1. Generate a device code
  const { userCode, code } = await t.mutation(api.deviceCodes.generate, {
    serverId: "test-server-id",
  });

  expect(userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  expect(code).toBeDefined();

  // 2. Poll (should be pending)
  const statusPending = await t.query(api.deviceCodes.poll, { code });
  expect(statusPending.status).toBe("pending");

  // 3. Create a user
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
        githubUserId: 12345,
        githubUsername: "testuser"
    });
  });

  // 4. Authorize
  await t.mutation(api.deviceCodes.authorize, { userCode, userId });

  // 5. Poll again (should be authorized)
  const statusAuthorized = await t.query(api.deviceCodes.poll, { code });
  expect(statusAuthorized.status).toBe("authorized");
  expect(statusAuthorized.userId).toBe(userId);
  expect(statusAuthorized.serverId).toBe("test-server-id");
});
