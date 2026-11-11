// Startinhalte: werden einmalig angelegt, wenn die Datenbank noch leer ist.
// Alles davon kann in der App geändert oder gelöscht werden.

export const SEED_ROOMS = [
  { name: 'Wohnzimmer', emoji: '🛋️' },
  { name: 'Schlafzimmer', emoji: '🛏️' },
  { name: 'Küche', emoji: '🍳' },
  { name: 'Bad', emoji: '🛁' },
  { name: 'Flur', emoji: '🚪' },
];

export const SEED_CHECKLIST = {
  p1: [
    'Alte Wohnung(en) fristgerecht kündigen',
    'Umzugstermin festlegen & Urlaub eintragen',
    'Transporter oder Umzugsfirma & Helfer organisieren',
    'Internet für die neue Wohnung bestellen (Vorlauf oft mehrere Wochen)',
    'Ausmisten: verkaufen, verschenken, wegwerfen',
  ],
  p2: [
    'Termin im Bürgerbüro zum Ummelden buchen (in München früh buchen!)',
    'Wohnungsgeberbestätigung vom Vermieter holen',
    'Halteverbotszone für den Umzugstag beantragen',
    'Stromvertrag für die neue Wohnung abschließen',
    'Nachsendeauftrag bei der Post einrichten',
    'Kartons & Packmaterial besorgen',
    'Sperrmüll anmelden',
  ],
  p3: [
    'Kisten packen & beschriften (Nummer + Zielraum)',
    'Dokumente & Wertsachen separat packen',
    'Kühlschrank abtauen',
    'Werkzeug, Snacks & Getränke für die Helfer besorgen',
  ],
  p4: [
    'Übergabe neue Wohnung: Protokoll machen, Mängel fotografieren',
    'Zählerstände in der neuen Wohnung fotografieren',
    'Übergabe alte Wohnung & Zählerstände notieren',
  ],
  p5: [
    'Ummelden im Bürgerbüro (innerhalb von 2 Wochen)',
    'Neue Adresse an Bank, Arbeitgeber, Krankenkasse & Versicherungen',
    'Rundfunkbeitrag: nur einer zahlt pro Wohnung, zweite Person abmelden',
    'Namen an Briefkasten & Klingel',
    'Kaution der alten Wohnung zurückfordern',
  ],
};

export const SEED_CONTRACTS = [
  { name: 'Mietvertrag & Kaution', provider: 'Vermieter / Hausverwaltung' },
  { name: 'Strom' },
  { name: 'Internet' },
  { name: 'Hausratversicherung' },
  { name: 'Haftpflicht', notes: 'Neue Adresse mitteilen' },
  { name: 'Rundfunkbeitrag', notes: 'Pro Wohnung zahlt nur einer' },
];

// Nur für den Demo-Modus: ein paar Beispiele, damit man sieht, wie es aussieht.
export const DEMO_EXTRAS = {
  items: [
    { room: 0, title: 'Sofa (3-Sitzer, Cord)', price: 1290, status: 'geplant', by: 0, url: 'https://example.com/sofa' },
    { room: 0, title: 'Teppich, Wolle 200×300', price: 240, status: 'idee', by: 1 },
    { room: 0, title: 'Stehlampe', price: 129, status: 'idee', by: 1 },
    { room: 1, title: 'Bett 180×200, Eiche', price: 649, status: 'gekauft', by: 0, paidBy: 0 },
    { room: 1, title: 'Kleiderschrank', price: 520, status: 'geplant', by: 1 },
    { room: 2, title: 'Esstisch für 4', price: 450, status: 'idee', by: 0 },
    { room: 4, title: 'Spiegel & Garderobe', price: 89, status: 'idee', by: 1 },
  ],
  expenses: [
    { title: 'Umzugskartons (20 Stück)', amount: 45.9, paidBy: 1, category: 'umzug', daysAgo: 6 },
    { title: 'Transporter reserviert (Anzahlung)', amount: 60, paidBy: 0, category: 'umzug', daysAgo: 3 },
    { title: 'Duschvorhang & Badezubehör', amount: 64.5, paidBy: 1, room: 3, daysAgo: 1 },
  ],
  todos: [
    { title: 'Maße vom Schlafzimmer nehmen', assignee: 1, inDays: 2, room: 1 },
    { title: 'Lampen für Flur & Bad aussuchen', inDays: 9 },
    { title: 'Bett-Lieferung mit dem Möbelhaus abstimmen', assignee: 0, inDays: -1 },
  ],
  boxes: [
    { room: 2, contents: 'Teller, Gläser, Tassen', fragile: true },
    { room: 0, contents: 'Bücher, Brettspiele' },
    { room: 1, contents: 'Bettwäsche, Handtücher, Kissen' },
  ],
};
