describe("fetch", () => {
  test("fetch-ed content", async () => {
    const page = await globalThis.__BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/fetch-test.html/reset");

    const textSelector = await page.waitForSelector("m-label");
    const fullTitle = await textSelector?.evaluate((el) => el.getAttribute("content"));
    expect(fullTitle).toEqual(`{"foo":"bar","baz":123}`);

    await page.close();
  }, 60000);
});
