CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  p1 TEXT,
  p2 TEXT,
  p3 TEXT,
  p4 TEXT,
  p5 TEXT,
  p6 TEXT,
  p7 TEXT,
  p8 TEXT,
  p9 TEXT,
  p10 TEXT,
  p11 TEXT,
  p12 TEXT,
  p13 TEXT,
  p14 TEXT,
  p15 TEXT,
  p15_direccion TEXT,
  p16 TEXT,
  p17_horario TEXT,
  p17_dias TEXT,
  p17_solo_email TEXT,
  p18_precio TEXT,
  observaciones TEXT,
  wantRaffle TEXT,
  wantReport TEXT,
  acceptGDPR TEXT,
  priority TEXT,
  participatesInRaffle INTEGER,
  raffleNumber INTEGER,
  timestamp TEXT,
  gestor TEXT
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR REPLACE INTO config (key, value) VALUES ('nextRaffleNumber', '81');
