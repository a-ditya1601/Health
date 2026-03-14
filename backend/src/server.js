require("dotenv").config();

const app = require("./app");
const { connectDatabase } = require("./config/database");

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
    await connectDatabase();

    app.listen(PORT, () => {
        console.log(`Backend API listening on http://localhost:${PORT}`);
    });
}

startServer().catch((error) => {
    console.error("Failed to start backend server:", error);
    process.exit(1);
});
