import { Filter } from 'bad-words'

const filter = new Filter()

// Add additional slurs/hate speech terms that the default list may miss
filter.addWords(
  'coon',
  'redskin',
  'redskins',
  'wetback',
  'beaner',
  'gook',
  'raghead',
  'towelhead',
  'sandnigger',
  'zipperhead',
  'negro',
  'negroid',
  'jiggaboo',
  'darkie',
  'cracker',
  'honky',
  'gringo',
  'kike',
  'hymie',
  'sheeny',
  'wop',
  'dago',
  'polack',
  'jigaboo',
  'pickaninny',
  'sambo',
  'mongoloid',
  'retarded',
  'tard',
)

/**
 * Returns true if the text contains profanity, slurs, or hate speech.
 */
export function containsProfanity(text: string): boolean {
  return filter.isProfane(text)
}

/**
 * Returns the text with profane words replaced with asterisks.
 */
export function censorText(text: string): string {
  return filter.clean(text)
}
