/**
 * Curated nicknames for well-known players. Keys are exact full names as
 * returned by BallDontLie (matched case-insensitively). Values are a list of
 * nicknames to recognize in article text.
 *
 * These ONLY activate if the player's full name also appears in the article
 * (the two-pass annotator's "confirmed" set). That gates nicknames against
 * false positives — "the Beard" won't match unless "James Harden" is also
 * present in the same piece.
 */
export const PLAYER_ALIASES: Record<string, string[]> = {
  'LeBron James': ['the King', 'King James', 'Bron', 'Bron Bron'],
  'Kevin Durant': ['KD', 'the Slim Reaper', 'the Durantula', 'Easy Money Sniper'],
  'Stephen Curry': ['Steph', 'Chef Curry', 'Baby-Faced Assassin'],
  'Shai Gilgeous-Alexander': ['SGA', 'Shai'],
  'Giannis Antetokounmpo': ['the Greek Freak', 'Greek Freak', 'Giannis'],
  'Nikola Jokic': ['the Joker', 'Joker'],
  'Luka Doncic': ['Luka', 'Luka Magic'],
  'Joel Embiid': ['JoJo', 'the Process'],
  'James Harden': ['the Beard'],
  'Russell Westbrook': ['Russ', 'Brodie'],
  'Damian Lillard': ['Dame', 'Dame Time', 'Dame Dolla'],
  'Kyrie Irving': ['Uncle Drew', 'Kai'],
  'Paul George': ['PG', 'PG13'],
  'Jayson Tatum': ['JT'],
  'Anthony Edwards': ['Ant', 'Ant-Man'],
  'Victor Wembanyama': ['Wemby', 'the Alien'],
  'Tyrese Haliburton': ['Hali'],
  'Ja Morant': ['Ja'],
  'Chris Paul': ['CP3'],
  'Karl-Anthony Towns': ['KAT'],
  'DeMar DeRozan': ['DeMar'],
  'De\u2019Aaron Fox': ['Swipa'],
  'Donovan Mitchell': ['Spida'],
  'Bradley Beal': ['Bubba'],
  'Draymond Green': ['Dray'],
  'Klay Thompson': ['Klay'],
  'Jimmy Butler': ['Jimmy Buckets', 'Himmy Buckets'],
  'Trae Young': ['Ice Trae'],
  'Devin Booker': ['Book'],
  'Alperen Sengun': ['Baby Jokic'],
  'Domantas Sabonis': ['Domas'],
  'Pascal Siakam': ['Spicy P'],
  'Kawhi Leonard': ['the Klaw'],
  'LaMelo Ball': ['Melo'],
  'Zion Williamson': ['Zion'],
  'Jaren Jackson Jr.': ['JJJ', 'Trip J'],
  'Kristaps Porzingis': ['KP', 'the Unicorn'],
}
