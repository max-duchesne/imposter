/**
 * Combinatorial clue candidate generation from fact atoms.
 * Single facts + pairs + triples → enough selective candidates to fill bands.
 */

export function makeClue(text, type, predicate, meta = {}) {
  return { text, type, predicate, ...meta };
}

function atom(text, type, predicate, meta = {}) {
  return { text, type, predicate, ...meta };
}

function activeAtoms(p) {
  const atoms = [];
  if (p.conf) {
    atoms.push(
      atom(
        `in the ${p.conf} Conference`,
        "geography",
        (x) => x.active && x.conf === p.conf,
      ),
    );
  }
  if (p.div) {
    atoms.push(
      atom(
        `in the ${p.div} Division`,
        "geography",
        (x) => x.active && x.div === p.div,
      ),
    );
  }
  if (p.state && !["Ontario", "District of Columbia"].includes(p.state)) {
    atoms.push(
      atom(
        `on a team based in ${p.state}`,
        "geography",
        (x) => x.active && x.state === p.state,
      ),
    );
  }
  if (p.region && ["West", "Midwest", "Southeast", "Northeast", "Southwest", "South", "Canada"].includes(p.region)) {
    atoms.push(
      atom(
        p.region === "Canada"
          ? "on the league's Canadian franchise"
          : `on a ${p.region} franchise`,
        "geography",
        (x) => x.active && x.region === p.region,
      ),
    );
  }

  if (p.pos) {
    const label = {
      PG: "point guard",
      SG: "shooting guard",
      SF: "small forward",
      PF: "power forward",
      C: "center",
    }[p.pos];
    if (label) {
      atoms.push(atom(`a ${label}`, "position", (x) => x.active && x.pos === p.pos));
    }
  }
  if (p.guard) atoms.push(atom("a guard", "position", (x) => x.active && x.guard));
  if (p.forward) atoms.push(atom("a forward", "position", (x) => x.active && x.forward));
  if (p.big) atoms.push(atom("a big man", "position", (x) => x.active && x.big));

  if (p.age != null) {
    for (const [t, label] of [
      [22, "age 22 or younger"],
      [24, "age 24 or younger"],
      [26, "age 26 or younger"],
    ]) {
      if (p.age <= t) {
        atoms.push(
          atom(label, "era", (x) => x.active && x.age != null && x.age <= t),
        );
      }
    }
    for (const [t, label] of [
      [30, "age 30 or older"],
      [33, "age 33 or older"],
      [36, "age 36 or older"],
    ]) {
      if (p.age >= t) {
        atoms.push(
          atom(label, "era", (x) => x.active && x.age != null && x.age >= t),
        );
      }
    }
  }

  if (p.pts != null) {
    for (const t of [12, 15, 18, 20, 22, 25, 28, 30]) {
      if (p.pts >= t) {
        atoms.push(
          atom(
            `averaging ${t}+ points`,
            "stat",
            (x) => x.active && x.pts != null && x.pts >= t,
            { statKey: "pts", threshold: t },
          ),
        );
      }
    }
  }
  if (p.trb != null) {
    for (const t of [5, 7, 8, 9, 10, 12]) {
      if (p.trb >= t) {
        atoms.push(
          atom(
            `averaging ${t}+ rebounds`,
            "stat",
            (x) => x.active && x.trb != null && x.trb >= t,
            { statKey: "trb", threshold: t },
          ),
        );
      }
    }
  }
  if (p.ast != null) {
    for (const t of [4, 5, 6, 7, 8, 10]) {
      if (p.ast >= t) {
        atoms.push(
          atom(
            `averaging ${t}+ assists`,
            "stat",
            (x) => x.active && x.ast != null && x.ast >= t,
            { statKey: "ast", threshold: t },
          ),
        );
      }
    }
  }
  if (p.fg3 != null) {
    for (const t of [2, 2.5, 3, 3.5, 4]) {
      if (p.fg3 >= t) {
        atoms.push(
          atom(
            `averaging ${t}+ threes`,
            "stat",
            (x) => x.active && x.fg3 != null && x.fg3 >= t,
            { statKey: "fg3", threshold: t },
          ),
        );
      }
    }
  }
  if (p.stl != null) {
    for (const t of [1.2, 1.5, 1.8]) {
      if (p.stl >= t) {
        atoms.push(
          atom(
            `averaging ${t}+ steals`,
            "stat",
            (x) => x.active && x.stl != null && x.stl >= t,
            { statKey: "stl", threshold: t },
          ),
        );
      }
    }
  }
  if (p.blk != null) {
    for (const t of [1.0, 1.5, 2.0]) {
      if (p.blk >= t) {
        atoms.push(
          atom(
            `averaging ${t}+ blocks`,
            "stat",
            (x) => x.active && x.blk != null && x.blk >= t,
            { statKey: "blk", threshold: t },
          ),
        );
      }
    }
  }

  if (p.asThisSeason) {
    atoms.push(atom("an All-Star this season", "award", (x) => x.active && x.asThisSeason));
  }
  if (p.allNba) {
    atoms.push(atom("an All-NBA selection this season", "award", (x) => x.active && x.allNba));
  }
  if (p.defThisSeason) {
    atoms.push(
      atom("an All-Defensive selection this season", "award", (x) => x.active && x.defThisSeason),
    );
  }
  if (p.allStarCount >= 1) {
    atoms.push(atom("a career All-Star", "award", (x) => x.allStarCount >= 1));
  }
  if (p.allStarCount >= 3) {
    atoms.push(atom("a three-time All-Star", "award", (x) => x.allStarCount >= 3));
  }
  if (p.allStarCount >= 5) {
    atoms.push(atom("a five-time All-Star", "award", (x) => x.allStarCount >= 5));
  }
  if (p.allDefenseCount >= 1) {
    atoms.push(
      atom("an All-Defensive Team honoree", "award", (x) => x.allDefenseCount >= 1),
    );
  }
  if (p.mvp) atoms.push(atom("an MVP winner", "award", (x) => x.mvp));
  if (p.scoringTitle) {
    atoms.push(atom("a scoring-title winner", "award", (x) => x.scoringTitle));
  }

  return atoms;
}

function hofAtoms(p) {
  const atoms = [];
  const confs = p.conferences ?? (p.conf ? [p.conf] : []);
  const states = p.states ?? (p.state ? [p.state] : []);

  for (const conf of confs) {
    atoms.push(
      atom(
        `associated with the ${conf} Conference`,
        "geography",
        (x) => !x.active && (x.conferences?.includes(conf) || x.conf === conf),
      ),
    );
  }
  for (const st of states) {
    if (["Texas", "California", "Florida", "Massachusetts", "Pennsylvania", "Illinois"].includes(st)) {
      atoms.push(
        atom(
          `who starred for a ${st} franchise`,
          "geography",
          (x) => !x.active && (x.states?.includes(st) || x.state === st),
        ),
      );
    }
  }
  if (p.guard) atoms.push(atom("a guard", "position", (x) => !x.active && x.guard));
  if (p.forward) atoms.push(atom("a forward", "position", (x) => !x.active && x.forward));
  if (p.big) atoms.push(atom("a big man", "position", (x) => !x.active && x.big));
  if (p.pos === "C") atoms.push(atom("a center", "position", (x) => !x.active && x.pos === "C"));
  if (p.pos === "PG") atoms.push(atom("a point guard", "position", (x) => !x.active && x.pos === "PG"));
  if (p.pos === "SG") atoms.push(atom("a shooting guard", "position", (x) => !x.active && x.pos === "SG"));

  if (p.era) {
    atoms.push(atom(`who starred in the ${p.era}`, "era", (x) => !x.active && x.era === p.era));
  }
  for (const d of p.decades ?? []) {
    atoms.push(
      atom(`who played in the ${d}`, "era", (x) => !x.active && x.decades?.includes(d)),
    );
  }
  if (p.mvp) atoms.push(atom("who won MVP", "award", (x) => !x.active && x.mvp));
  if (p.champion) {
    atoms.push(atom("who won a championship", "award", (x) => !x.active && x.champion));
  } else {
    atoms.push(atom("who never won a championship", "award", (x) => !x.active && !x.champion));
  }
  if (p.scoringTitle) {
    atoms.push(atom("who led the league in scoring", "award", (x) => !x.active && x.scoringTitle));
  }
  if (p.allDefenseCount >= 1) {
    atoms.push(
      atom("named to an All-Defensive Team", "award", (x) => !x.active && x.allDefenseCount >= 1),
    );
  }
  if ((p.titles ?? 0) >= 3) {
    atoms.push(
      atom("with at least three championships", "award", (x) => !x.active && (x.titles ?? 0) >= 3),
    );
  }
  if ((p.titles ?? 0) >= 5) {
    atoms.push(
      atom("with at least five championships", "award", (x) => !x.active && (x.titles ?? 0) >= 5),
    );
  }
  return atoms;
}

function combineActive(atoms) {
  const clues = [];
  // Singles
  for (const a of atoms) {
    const text = a.text.startsWith("a ") || a.text.startsWith("an ")
      ? `An active player who is ${a.text}`
      : a.text.startsWith("averaging")
        ? `An active player ${a.text} this season`
        : a.text.startsWith("on ") || a.text.startsWith("in ")
          ? `An active player ${a.text}`
          : `An active player who is ${a.text}`;
    // Cleaner phrasing for common patterns
    let nice = text;
    if (a.type === "geography" && a.text.startsWith("in the")) {
      nice = `An active player ${a.text}`;
    } else if (a.type === "geography" && a.text.startsWith("on ")) {
      nice = `An active player ${a.text}`;
    } else if (a.type === "position" && a.text.startsWith("a ")) {
      nice = `An active ${a.text.slice(2)}`;
    } else if (a.type === "stat") {
      nice = `Averaged ${a.text.replace("averaging ", "")} per game this season`;
    } else if (a.type === "award") {
      nice = `An active player who is ${a.text}`;
    } else if (a.type === "era") {
      nice = `An active player ${a.text}`;
    }
    clues.push(makeClue(nice, a.type, a.predicate, { statKey: a.statKey, threshold: a.threshold }));
  }

  // Pairs (different types preferred)
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const a = atoms[i];
      const b = atoms[j];
      if (a.type === b.type && a.type === "stat") continue; // avoid dual stat bands
      if (a.statKey && a.statKey === b.statKey) continue;
      const pred = (x) => a.predicate(x) && b.predicate(x);
      const type = a.type === b.type ? a.type : "combo";
      const text = phraseActivePair(a, b);
      clues.push(
        makeClue(text, type, pred, {
          statKey: a.statKey || b.statKey,
          threshold: a.threshold ?? b.threshold,
        }),
      );
    }
  }

  // Triples: geography/position + two others, capped for cost
  const geoPos = atoms.filter((a) => a.type === "geography" || a.type === "position");
  const others = atoms.filter((a) => a.type !== "geography" && a.type !== "position");
  let tripleCount = 0;
  for (const a of geoPos.slice(0, 4)) {
    for (let i = 0; i < others.length && tripleCount < 40; i++) {
      for (let j = i + 1; j < others.length && tripleCount < 40; j++) {
        const b = others[i];
        const c = others[j];
        if (b.statKey && b.statKey === c.statKey) continue;
        if (b.type === "stat" && c.type === "stat") continue;
        const pred = (x) => a.predicate(x) && b.predicate(x) && c.predicate(x);
        clues.push(
          makeClue(phraseActiveTriple(a, b, c), "combo", pred, {
            statKey: b.statKey || c.statKey,
          }),
        );
        tripleCount++;
      }
    }
  }
  return clues;
}

function phraseActivePair(a, b) {
  // Prefer natural phrasing
  const pos = [a, b].find((x) => x.type === "position" && x.text.startsWith("a "));
  const geo = [a, b].find((x) => x.type === "geography");
  const stat = [a, b].find((x) => x.type === "stat");
  const award = [a, b].find((x) => x.type === "award");
  const era = [a, b].find((x) => x.type === "era");

  if (pos && geo) {
    return `An active ${pos.text.slice(2)} ${geo.text}`;
  }
  if (pos && stat) {
    return `An active ${pos.text.slice(2)} ${stat.text} this season`;
  }
  if (pos && award) {
    return `An active ${pos.text.slice(2)} who is ${award.text}`;
  }
  if (pos && era) {
    return `An active ${pos.text.slice(2)} ${era.text}`;
  }
  if (geo && stat) {
    return `An active player ${geo.text} ${stat.text} this season`;
  }
  if (geo && award) {
    return `An active player ${geo.text} who is ${award.text}`;
  }
  if (geo && era) {
    return `An active player ${geo.text}, ${era.text}`;
  }
  if (stat && award) {
    return `An active player who is ${award.text}, ${stat.text} this season`;
  }
  if (stat && era) {
    return `An active player ${era.text}, ${stat.text} this season`;
  }
  if (award && era) {
    return `An active player ${era.text} who is ${award.text}`;
  }
  return `An active player who is ${a.text} and ${b.text}`;
}

function phraseActiveTriple(a, b, c) {
  const parts = [a, b, c];
  const pos = parts.find((x) => x.type === "position" && x.text.startsWith("a "));
  const rest = parts.filter((x) => x !== pos);
  if (pos) {
    return `An active ${pos.text.slice(2)} ${rest.map((r) => r.text).join(", ")}`.replace(
      ", averaging",
      " averaging",
    ) + (rest.some((r) => r.type === "stat") ? " this season" : "");
  }
  return `An active player ${parts.map((r) => r.text).join(", ")} this season`;
}

function combineHof(atoms) {
  const clues = [];
  for (const a of atoms) {
    let nice;
    if (a.type === "position" && a.text.startsWith("a ")) {
      nice = `A Hall of Fame ${a.text.slice(2)}`;
    } else if (a.text.startsWith("who ") || a.text.startsWith("with ") || a.text.startsWith("named ")) {
      nice = `A Hall of Famer ${a.text}`;
    } else if (a.text.startsWith("associated ")) {
      nice = `A Hall of Famer ${a.text}`;
    } else {
      nice = `A Hall of Famer ${a.text}`;
    }
    clues.push(makeClue(nice, a.type, a.predicate));
  }
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const a = atoms[i];
      const b = atoms[j];
      if (a.type === b.type && a.type !== "award") continue;
      const type = a.type === b.type ? a.type : "combo";
      const pos = [a, b].find((x) => x.type === "position" && x.text.startsWith("a "));
      const other = pos === a ? b : a;
      let text;
      if (pos) {
        text = `A Hall of Fame ${pos.text.slice(2)} ${other.text}`;
      } else {
        text = `A Hall of Famer ${a.text}, ${b.text}`;
      }
      clues.push(makeClue(text, type, (x) => a.predicate(x) && b.predicate(x)));
    }
  }
  return clues;
}

export function activeCandidates(p) {
  return combineActive(activeAtoms(p));
}

export function hofCandidates(p) {
  return combineHof(hofAtoms(p));
}
