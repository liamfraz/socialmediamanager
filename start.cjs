process.on("uncaughtException", (err) => {
  console.error("CRASH:", err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED:", err);
  process.exit(1);
});
require("./dist/index.cjs");
