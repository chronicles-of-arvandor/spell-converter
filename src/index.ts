import { stringify } from 'yaml';
import * as fs from 'fs';
import * as readline from 'readline';
import {
  Ability, AreaTag,
  Condition,
  ConeSpellRange, CreatureType,
  CubeSpellRange, DamageType, EntriesSpellEntry,
  HemisphereSpellRange, InsetSpellEntry, InstantSpellDuration,
  LineSpellRange, ListSpellEntry,
  MaterialSpellComponent, MiscTag, PermanentSpellDuration, PermanentSpellEnd,
  PointSpellRange,
  RadiusSpellRange, SpecialSpellDuration,
  SpecialSpellRange,
  Spell, SpellAttack,
  SpellComponents,
  SpellComponentsWithNoMaterial,
  SpellComponentsWithObjectMaterial,
  SpellComponentsWithStringMaterial, SpellDuration, SpellEntry, SpellMeta,
  SpellRange,
  SpellRangeDistance,
  SpellRangeDistanceFeet,
  SpellRangeDistanceMile,
  SpellRangeDistanceSelf,
  SpellRangeDistanceSight,
  SpellRangeDistanceTouch,
  SpellRangeDistanceUnlimited, SpellScalingLevelDice,
  SpellSchool,
  SpellTime,
  SpellTimeUnit,
  SphereSpellRange, StringSpellEntry, TableSpellEntry, TimedSpellDuration, TimedSpellDurationType
} from './spell';
import { v4 as randomUuid } from 'uuid';

function convertSchool(school: string): SpellSchool {
  switch (school) {
    case 'A': return 'ABJURATION';
    case 'C': return 'CONJURATION';
    case 'D': return 'DIVINATION';
    case 'E': return 'ENCHANTMENT';
    case 'V': return 'EVOCATION';
    case 'I': return 'ILLUSION';
    case 'N': return 'NECROMANCY';
    case 'T': return 'TRANSMUTATION';
    default: throw new Error(`Invalid school: ${school}`);
  }
}

function convertTimeUnit(unit: string): SpellTimeUnit {
  switch (unit) {
    case 'action': return 'ACTION';
    case 'bonus': return 'BONUS';
    case 'reaction': return 'REACTION';
    case 'minute': return 'MINUTE';
    case 'hour': return 'HOUR';
    default: throw new Error(`Invalid time unit: ${unit}`);
  }
}

function convertTime(time: { number: number, unit: string }): SpellTime {
  const unit = convertTimeUnit(time.unit);
  return new SpellTime(time.number, unit);
}

function convertTimes(times: { number: number, unit: string }[]) {
  return times.map((time: any) => convertTime(time));
}

function convertDistance(distance: any): SpellRangeDistance {
  switch (distance.type) {
    case 'feet': return new SpellRangeDistanceFeet(distance.amount);
    case 'miles': return new SpellRangeDistanceMile(distance.amount);
    case 'self': return new SpellRangeDistanceSelf();
    case 'touch': return new SpellRangeDistanceTouch();
    case 'sight': return new SpellRangeDistanceSight();
    case 'unlimited': return new SpellRangeDistanceUnlimited();
    default: throw new Error(`Invalid distance type: ${distance.type}`);
  }
}

function convertRange(range: any): SpellRange {
  switch (range.type) {
    case 'point': return new PointSpellRange(convertDistance(range.distance));
    case 'radius': return new RadiusSpellRange(convertDistance(range.distance));
    case 'sphere': return new SphereSpellRange(convertDistance(range.distance));
    case 'cone': return new ConeSpellRange(convertDistance(range.distance));
    case 'special': return new SpecialSpellRange();
    case 'line': return new LineSpellRange(convertDistance(range.distance));
    case 'hemisphere': return new HemisphereSpellRange(convertDistance(range.distance));
    case 'cube': return new CubeSpellRange(convertDistance(range.distance));
    default: throw new Error(`Invalid range type: ${range.type}`);
  }
}

function convertComponents(components: any): SpellComponents {
  const verbal = components.v;
  const somatic = components.s;
  const material = components.m;
  if (material) {
    if (typeof material === 'string') {
      return new SpellComponentsWithStringMaterial(verbal, somatic, material);
    } else if (typeof material === 'object') {
      return new SpellComponentsWithObjectMaterial(
        verbal,
        somatic,
        new MaterialSpellComponent(
          material.text,
          material.cost,
          material.consume
        )
      );
    } else {
      throw new Error(`Invalid material type: ${typeof material}`);
    }
  } else {
    return new SpellComponentsWithNoMaterial(verbal, somatic);
  }
}

function convertDurationType(durationType: string): TimedSpellDurationType {
  switch (durationType) {
    case 'minute': return 'MINUTE';
    case 'hour': return 'HOUR';
    case 'day': return 'DAY';
    case 'round': return 'ROUND';
    default: throw new Error(`Invalid duration type: ${durationType}`);
  }
}

function convertEnd(end: string): PermanentSpellEnd {
  switch (end) {
    case 'dispel': return 'DISPEL';
    case 'trigger': return 'TRIGGER';
    default: throw new Error(`Invalid end: ${end}`);
  }
}

function convertDuration(duration: any): SpellDuration {
  switch (duration.type) {
    case 'instant': return new InstantSpellDuration();
    case 'timed': return new TimedSpellDuration(
      convertDurationType(duration.duration.type),
      duration.duration.amount,
      duration.concentration
    );
    case 'permanent': return new PermanentSpellDuration(duration.ends.map((end: string) => convertEnd(end)))
    case 'special': return new SpecialSpellDuration();
    default: throw new Error(`Invalid duration type: ${duration.type}`);
  }
}

function convertDurations(durations: any[]): SpellDuration[] {
  return durations.map((duration: any) => convertDuration(duration));
}

function convertMeta(meta: any): SpellMeta | undefined {
  if (meta === undefined) {
    return undefined;
  }
  if (Object.keys(meta).some((key: string) => key !== 'ritual')) {
    Object.keys(meta).filter((key: string) => key !== 'ritual')
      .forEach((key: string) => console.log(`Unknown meta key: ${key}`));
  }
  return new SpellMeta(
    meta.ritual
  )
}

function convertEntry(entry: any): SpellEntry {
  if (typeof entry === 'string') {
    return new StringSpellEntry(entry);
  } else {
    switch (entry.type) {
      case 'entries': return new EntriesSpellEntry(entry.name, entry.entries);
      case 'table': return new TableSpellEntry(entry.caption, entry.colLabels, entry.colStyles, entry.rows);
      case 'list': return new ListSpellEntry(entry.items);
      case 'inset': return new InsetSpellEntry(entry.source, entry.page, entry.name, entry.entries);
      default: throw new Error(`Invalid entry type: ${entry.type}`);
    }
  }
}

function convertEntries(entries: any[] | undefined): SpellEntry[] | undefined {
  if (entries === undefined) {
    return undefined;
  }
  return entries.map((entry: any) => convertEntry(entry));
}

function convertScalingLevelDice(scalingLevelDice: any | any[] | undefined): SpellScalingLevelDice[] | undefined {
  if (scalingLevelDice === undefined) {
    return undefined;
  }
  if (Array.isArray(scalingLevelDice)) {
    return scalingLevelDice.map((sld: any) => new SpellScalingLevelDice(
      sld.label,
      Object.fromEntries<string>(
        Object.entries<string>(sld.scaling).map(([level, dice]) => ([parseInt(level), dice]))
      )
    ));
  } else if (typeof scalingLevelDice === 'object') {
    return [
      new SpellScalingLevelDice(
        scalingLevelDice.label,
        Object.fromEntries<string>(
          Object.entries<string>(scalingLevelDice.scaling).map(([level, dice]) => ([parseInt(level), dice]))
        )
      )
    ]
  } else {
    throw new Error(`Invalid scaling level dice: ${scalingLevelDice}`);
  }
}

function convertDamageType(damageType: string): DamageType {
  switch (damageType) {
    case 'acid': return 'ACID';
    case 'bludgeoning': return 'BLUDGEONING';
    case 'cold': return 'COLD';
    case 'fire': return 'FIRE';
    case 'force': return 'FORCE';
    case 'lightning': return 'LIGHTNING';
    case 'necrotic': return 'NECROTIC';
    case 'piercing': return 'PIERCING';
    case 'poison': return 'POISON';
    case 'psychic': return 'PSYCHIC';
    case 'radiant': return 'RADIANT';
    case 'slashing': return 'SLASHING';
    case 'thunder': return 'THUNDER';
    default: throw new Error(`Invalid damage type: ${damageType}`);
  }
}

function convertDamageInflict(damageInflict: string[] | undefined): DamageType[] | undefined {
  if (damageInflict === undefined) {
    return undefined;
  }
  return damageInflict.map((damageType) => convertDamageType(damageType));
}

function convertSpellAttack(spellAttack: string[] | undefined): SpellAttack[] | undefined {
  if (spellAttack === undefined) {
    return undefined;
  }
  return spellAttack.map((spellAttack) => {
    switch (spellAttack) {
      case 'R': return 'RANGED';
      case 'M': return 'MELEE';
      default: throw new Error(`Invalid spell attack: ${spellAttack}`);
    }
  });
}

function convertCondition(condition: string): Condition {
  switch (condition) {
    case 'blinded': return 'BLINDED';
    case 'charmed': return 'CHARMED';
    case 'deafened': return 'DEAFENED';
    case 'exhaustion': return 'EXHAUSTION';
    case 'frightened': return 'FRIGHTENED';
    case 'grappled': return 'GRAPPLED';
    case 'incapacitated': return 'INCAPACITATED';
    case 'invisible': return 'INVISIBLE';
    case 'paralyzed': return 'PARALYZED';
    case 'petrified': return 'PETRIFIED';
    case 'poisoned': return 'POISONED';
    case 'prone': return 'PRONE';
    case 'restrained': return 'RESTRAINED';
    case 'stunned': return 'STUNNED';
    case 'unconscious': return 'UNCONSCIOUS';
    default: throw new Error(`Invalid condition: ${condition}`);
  }
}

function convertConditionInflict(conditionInflict: string[] | undefined): Condition[] | undefined {
  if (conditionInflict === undefined) {
    return undefined;
  }
  return conditionInflict.map((condition) => convertCondition(condition));
}

function convertAbility(ability: string): Ability {
  switch (ability) {
    case 'strength': return 'STRENGTH';
    case 'dexterity': return 'DEXTERITY';
    case 'constitution': return 'CONSTITUTION';
    case 'intelligence': return 'INTELLIGENCE';
    case 'wisdom': return 'WISDOM';
    case 'charisma': return 'CHARISMA';
    default: throw new Error(`Invalid ability: ${ability}`);
  }
}

function convertSavingThrow(savingThrow: string[] | undefined): Ability[] | undefined {
  if (savingThrow === undefined) {
    return undefined;
  }
  return savingThrow.map((ability) => convertAbility(ability));
}

function convertCreatureType(creatureType: string): CreatureType {
  switch (creatureType) {
    case 'aberration': return 'ABERRATION';
    case 'beast': return 'BEAST';
    case 'celestial': return 'CELESTIAL';
    case 'construct': return 'CONSTRUCT';
    case 'dragon': return 'DRAGON';
    case 'elemental': return 'ELEMENTAL';
    case 'fey': return 'FEY';
    case 'fiend': return 'FIEND';
    case 'giant': return 'GIANT';
    case 'humanoid': return 'HUMANOID';
    case 'monstrosity': return 'MONSTROSITY';
    case 'ooze': return 'OOZE';
    case 'plant': return 'PLANT';
    case 'undead': return 'UNDEAD';
    default: throw new Error(`Invalid creature type: ${creatureType}`);
  }
}

function convertAffectsCreatureType(affectsCreatureType: string[] | undefined): CreatureType[] | undefined {
  if (affectsCreatureType === undefined) {
    return undefined;
  }
  return affectsCreatureType.map((creatureType) => convertCreatureType(creatureType));
}

function convertMiscTag(miscTag: string): MiscTag {
  switch (miscTag) {
    case 'HL': return 'HEALING';
    case 'THP': return 'GRANTS_TEMPORARY_HIT_POINTS';
    case 'SGT': return 'REQUIRES_SIGHT';
    case 'PRM': return 'PERMANENT_EFFECTS';
    case 'SCL': return 'SCALING_EFFECTS';
    case 'SMN': return 'SUMMONS_CREATURE';
    case 'MAC': return 'MODIFIES_AC';
    case 'TP': return 'TELEPORTATION';
    case 'FMV': return 'FORCED_MOVEMENT';
    case 'RO': return 'ROLLABLE_EFFECTS';
    case 'LGTS': return 'CREATES_SUNLIGHT';
    case 'LGT': return 'CREATES_LIGHT';
    case 'UBA': return 'USES_BONUS_ACTION';
    case 'PS': return 'PLANE_SHIFTING';
    case 'OBS': return 'OBSCURES_VISION';
    case 'DFT': return 'DIFFICULT_TERRAIN';
    case 'AAD': return 'ADDITIONAL_ATTACK_DAMAGE';
    case 'OBJ': return 'AFFECTS_OBJECTS';
    default: throw new Error(`Invalid misc tag: ${miscTag}`);
  }
}

function convertMiscTags(miscTags: string[] | undefined): MiscTag[] | undefined {
  if (miscTags === undefined) {
    return undefined;
  }
  return miscTags.map((miscTag) => convertMiscTag(miscTag));
}

function convertAreaTag(areaTag: any): AreaTag {
  switch (areaTag) {
    case 'ST': return 'SINGLE_TARGET';
    case 'MT': return 'MULTIPLE_TARGETS';
    case 'C': return 'CUBE';
    case 'N': return 'CONE';
    case 'Y': return 'CYLINDER';
    case 'S': return 'SPHERE';
    case 'R': return 'CIRCLE';
    case 'Q': return 'SQUARE';
    case 'L': return 'LINE';
    case 'H': return 'HEMISPHERE';
    case 'W': return 'WALL';
    default: throw new Error(`Invalid area tag: ${areaTag}`);
  }
}

function convertAreaTags(areaTags: string[] | undefined): AreaTag[] | undefined {
  if (areaTags === undefined) {
    return undefined;
  }
  return areaTags.map((areaTag) => convertAreaTag(areaTag));
}

function parseSpell(spell: any): Spell {
  console.log(`Parsing ${spell.name}...`);
  return new Spell(
    randomUuid(),
    spell.name,
    spell.source,
    spell.page,
    spell.srd,
    spell.basicRules,
    spell.level,
    convertSchool(spell.school),
    convertTimes(spell.time),
    convertRange(spell.range),
    convertComponents(spell.components),
    convertDurations(spell.duration),
    convertMeta(spell.meta),
    convertEntries(spell.entries),
    convertEntries(spell.entriesHigherLevel),
    convertScalingLevelDice(spell.scalingLevelDice),
    convertDamageInflict(spell.damageInflict),
    convertSpellAttack(spell.spellAttack),
    convertConditionInflict(spell.conditionInflict),
    convertSavingThrow(spell.savingThrow),
    convertAffectsCreatureType(spell.affectsCreatureType),
    convertMiscTags(spell.miscTags),
    convertAreaTags(spell.areaTags)
  );
}

function convertFile(file: string, output: string) {
  const jsonData = JSON.parse(fs.readFileSync(file, 'utf8'));
  const spells = jsonData.spell.map((spell: any) => {
    try {
      return parseSpell(spell)
    } catch (e) {
      console.log("Error parsing spell: ", spell.name);
      console.log(e);
      throw e;
    }
  });
  spells.forEach((spell: Spell) => {
    console.log(`Serializing ${spell.name}...`);
    let spellYaml: string;
    try {
      spellYaml = stringify({ spell: spell.serialize() });
    } catch (e) {
      console.log("Error serializing spell: ", spell.name);
      console.log(e);
      throw e;
    }
    const spellFileName = spell.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    console.log(`Writing ${spell.name} to ${output}/${spellFileName}.yml...`);
    try {
      fs.writeFileSync(`${output}/${spellFileName}.yml`, spellYaml);
    } catch (e) {
      console.log("Error writing spell: ", spell.name);
      console.log(e);
      throw e;
    }
  });
  console.log('Done!');
}

let file: string;
let output: string;
const read = readline.createInterface(process.stdin, process.stdout);
read.setPrompt('5etools JSON file: ');
read.prompt();
read.on('line', (line) => {
  if (read.getPrompt() === '5etools JSON file: ') {
    let sanitizedLine = line.trim();
    if ((sanitizedLine.startsWith('"') && sanitizedLine.endsWith('"')) || (sanitizedLine.startsWith("'") && sanitizedLine.endsWith("'"))) {
      sanitizedLine = sanitizedLine.substring(1, sanitizedLine.length - 1);
    }
    if (fs.existsSync(sanitizedLine)) {
      file = sanitizedLine;
      read.setPrompt('Output directory: ');
      read.prompt();
    } else {
      console.log('Invalid file path.');
      read.prompt();
    }
  } else if (read.getPrompt() === 'Output directory: ') {
    let sanitizedLine = line.trim();
    if ((sanitizedLine.startsWith('"') && sanitizedLine.endsWith('"')) || (sanitizedLine.startsWith("'") && sanitizedLine.endsWith("'"))) {
      sanitizedLine = sanitizedLine.substring(1, sanitizedLine.length - 1);
    }
    if (fs.existsSync(sanitizedLine) && fs.lstatSync(sanitizedLine).isDirectory()) {
      output = sanitizedLine;
      read.close();
    } else {
      console.log('Invalid output directory.');
      read.prompt();
    }
  }
}).on('close', () => {
  convertFile(file, output);
  process.exit(0);
});