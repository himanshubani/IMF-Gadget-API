require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");

const app = express();
const prisma = new PrismaClient();
app.use(express.json());
app.use(cors());

const SECRET_KEY = process.env.JWT_SECRET || "supersecret";

function generateCodename() {
  const names = ["The Nightingale", "The Kraken", "Phantom", "Shadow"];
  return names[Math.floor(Math.random() * names.length)];
}

function generateSuccessProbability() {
  return Math.floor(Math.random() * 100) + 1;
}

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid token" });
  }
}

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, password: hashedPassword },
  });
  const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: "1h" });
  res.json({ token });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: "1h" });
  res.json({ token });
});

app.get("/gadgets", authenticate, async (req, res) => {
    const { status } = req.query;
  
    try {
      const gadgets = await prisma.gadget.findMany({
        where: status ? { status } : {}, 
      });
  
      res.json(
        gadgets.map((g) => ({
          ...g,
          missionSuccessProbability: `${generateSuccessProbability()}%`,
        }))
      );
    } catch (error) {
      res.status(500).json({ error: "Error fetching gadgets" });
    }
  });
  

app.post("/gadgets", authenticate, async (req, res) => {
  const newGadget = await prisma.gadget.create({
    data: { name: generateCodename() },
  });
  res.json(newGadget);
});

app.patch("/gadgets/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const updatedGadget = await prisma.gadget.update({
    where: { id },
    data: { status },
  });
  res.json(updatedGadget);
});

app.delete("/gadgets/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const decommissionedGadget = await prisma.gadget.update({
    where: { id },
    data: { status: "Decommissioned", decommissionedAt: new Date() },
  });
  res.json(decommissionedGadget);
});

app.post("/gadgets/:id/self-destruct", authenticate, async (req, res) => {
  const confirmationCode = Math.random().toString(36).substring(2, 8);
  res.json({ message: "Self-destruct initiated", confirmationCode });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
