import mysql from "mysql2/promise";

const globalForDb = globalThis as unknown as { cleberDb?: mysql.Pool };

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const db = globalForDb.cleberDb ?? mysql.createPool({
  host: required("DB_HOST"),
  port: Number(process.env.DB_PORT || 3306),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  database: required("DB_NAME"),
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  waitForConnections: true,
  queueLimit: 0,
  timezone: "-06:00",
  dateStrings: true,
  charset: "utf8mb4",
});

if (process.env.NODE_ENV !== "production") globalForDb.cleberDb = db;
