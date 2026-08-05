export interface TarotCard {
  id: string;
  order: number;
  arcana: number | null;
  title: string;
  label: string;
  image: string;
  sourceCell: { row: number; column: number };
  variant?: string;
}

export const tarotCardBack = '/tarot-cards/back.png';

/** Ordered Persona 5 Royal tarot faces extracted from the imported sheet. */
export const tarotCards = [
  { id: 'fool', order: 0, arcana: 0, title: 'The Fool', label: 'Le Mat', image: '/tarot-cards/00-le-mat.png', sourceCell: { row: 0, column: 1 } },
  { id: 'magician', order: 1, arcana: 1, title: 'The Magician', label: 'Le Bateleur', image: '/tarot-cards/01-le-bateleur.png', sourceCell: { row: 0, column: 2 } },
  { id: 'priestess', order: 2, arcana: 2, title: 'The High Priestess', label: 'La Papesse', image: '/tarot-cards/02-la-papesse.png', sourceCell: { row: 0, column: 3 } },
  { id: 'empress', order: 3, arcana: 3, title: 'The Empress', label: "L'Impératrice", image: '/tarot-cards/03-limperatrice.png', sourceCell: { row: 0, column: 4 } },
  { id: 'emperor', order: 4, arcana: 4, title: 'The Emperor', label: "L'Empereur", image: '/tarot-cards/04-lempereur.png', sourceCell: { row: 0, column: 5 } },
  { id: 'hierophant', order: 5, arcana: 5, title: 'The Hierophant', label: 'Le Pape', image: '/tarot-cards/05-le-pape.png', sourceCell: { row: 0, column: 6 } },
  { id: 'lovers', order: 6, arcana: 6, title: 'The Lovers', label: "L'Amoureux", image: '/tarot-cards/06-lamoureux.png', sourceCell: { row: 0, column: 7 } },
  { id: 'chariot', order: 7, arcana: 7, title: 'The Chariot', label: 'Le Chariot', image: '/tarot-cards/07-le-chariot.png', sourceCell: { row: 0, column: 8 } },
  { id: 'justice', order: 8, arcana: 8, title: 'Justice', label: 'La Justice', image: '/tarot-cards/08-la-justice.png', sourceCell: { row: 0, column: 9 } },
  { id: 'hermit', order: 9, arcana: 9, title: 'The Hermit', label: "L'Ermite", image: '/tarot-cards/09-lermite.png', sourceCell: { row: 1, column: 0 } },
  { id: 'wheel-of-fortune', order: 10, arcana: 10, title: 'Wheel of Fortune', label: 'La Roue de Fortune', image: '/tarot-cards/10-roue-de-fortune.png', sourceCell: { row: 1, column: 1 } },
  { id: 'strength', order: 11, arcana: 11, title: 'Strength', label: 'La Force', image: '/tarot-cards/11-la-force.png', sourceCell: { row: 1, column: 2 } },
  { id: 'hanged-man', order: 12, arcana: 12, title: 'The Hanged Man', label: 'Le Pendu', image: '/tarot-cards/12-le-pendu.png', sourceCell: { row: 1, column: 3 } },
  { id: 'death', order: 13, arcana: 13, title: 'Death', label: "L'Arcane sans nom", image: '/tarot-cards/13-arcane-sans-nom.png', sourceCell: { row: 1, column: 4 } },
  { id: 'temperance', order: 14, arcana: 14, title: 'Temperance', label: 'Tempérance', image: '/tarot-cards/14-temperance.png', sourceCell: { row: 1, column: 5 } },
  { id: 'devil', order: 15, arcana: 15, title: 'The Devil', label: 'Le Diable', image: '/tarot-cards/15-le-diable.png', sourceCell: { row: 1, column: 6 } },
  { id: 'tower', order: 16, arcana: 16, title: 'The Tower', label: 'La Maison Dieu', image: '/tarot-cards/16-la-maison-dieu.png', sourceCell: { row: 1, column: 7 } },
  { id: 'star', order: 17, arcana: 17, title: 'The Star', label: "L'Étoile", image: '/tarot-cards/17-letoile.png', sourceCell: { row: 1, column: 8 } },
  { id: 'moon', order: 18, arcana: 18, title: 'The Moon', label: 'La Lune', image: '/tarot-cards/18-la-lune.png', sourceCell: { row: 1, column: 9 } },
  { id: 'sun', order: 19, arcana: 19, title: 'The Sun', label: 'Le Soleil', image: '/tarot-cards/19-le-soleil.png', sourceCell: { row: 2, column: 0 } },
  { id: 'judgement', order: 20, arcana: 20, title: 'Judgement', label: 'Le Jugement', image: '/tarot-cards/20-le-jugement.png', sourceCell: { row: 2, column: 1 } },
  { id: 'world', order: 21, arcana: 21, title: 'The World', label: 'Le Monde', image: '/tarot-cards/21-le-monde.png', sourceCell: { row: 2, column: 2 } },
  { id: 'royal-faith-a', order: 22, arcana: null, title: 'Faith', label: 'La Foi', image: '/tarot-cards/royal-faith-a.png', sourceCell: { row: 2, column: 3 }, variant: 'a' },
  { id: 'royal-conqueror', order: 23, arcana: null, title: 'The Conqueror', label: 'Le Conquérant', image: '/tarot-cards/royal-conqueror.png', sourceCell: { row: 2, column: 4 } },
  { id: 'royal-faith-b', order: 24, arcana: null, title: 'Faith', label: 'La Foi', image: '/tarot-cards/royal-faith-b.png', sourceCell: { row: 2, column: 5 }, variant: 'b' },
] as const satisfies readonly TarotCard[];

export type TarotCardId = (typeof tarotCards)[number]['id'];

export function getTarotCard(id: TarotCardId): (typeof tarotCards)[number] {
  const card = tarotCards.find((candidate) => candidate.id === id);
  if (!card) {
    throw new Error(`Unknown tarot card: ${id}`);
  }
  return card;
}
