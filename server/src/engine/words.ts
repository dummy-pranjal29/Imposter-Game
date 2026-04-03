// ─────────────────────────────────────────────────────────────────────────────
// Word pairs — civilians get `civilian`, imposter gets `imposter`.
// Both words are from the same category so the imposter can plausibly bluff,
// but a careful description will expose the difference.
// ─────────────────────────────────────────────────────────────────────────────

export interface WordPair {
  civilian: string;
  imposter: string;
  category: string;
}

const WORD_PAIRS: WordPair[] = [
  // Animals
  { category: 'Animals',    civilian: 'Dolphin',      imposter: 'Shark'         },
  { category: 'Animals',    civilian: 'Lion',         imposter: 'Tiger'         },
  { category: 'Animals',    civilian: 'Eagle',        imposter: 'Hawk'          },
  { category: 'Animals',    civilian: 'Penguin',      imposter: 'Flamingo'      },
  { category: 'Animals',    civilian: 'Elephant',     imposter: 'Rhinoceros'    },
  { category: 'Animals',    civilian: 'Crocodile',    imposter: 'Alligator'     },
  { category: 'Animals',    civilian: 'Cheetah',      imposter: 'Leopard'       },
  { category: 'Animals',    civilian: 'Gorilla',      imposter: 'Chimpanzee'    },

  // Food
  { category: 'Food',       civilian: 'Pizza',        imposter: 'Calzone'       },
  { category: 'Food',       civilian: 'Sushi',        imposter: 'Sashimi'       },
  { category: 'Food',       civilian: 'Hamburger',    imposter: 'Hot Dog'       },
  { category: 'Food',       civilian: 'Croissant',    imposter: 'Danish Pastry' },
  { category: 'Food',       civilian: 'Taco',         imposter: 'Burrito'       },
  { category: 'Food',       civilian: 'Pancakes',     imposter: 'Waffles'       },
  { category: 'Food',       civilian: 'Ice Cream',    imposter: 'Gelato'        },
  { category: 'Food',       civilian: 'Cheesecake',   imposter: 'Tiramisu'      },

  // Places
  { category: 'Places',     civilian: 'Airport',      imposter: 'Train Station' },
  { category: 'Places',     civilian: 'Library',      imposter: 'Bookstore'     },
  { category: 'Places',     civilian: 'Stadium',      imposter: 'Arena'         },
  { category: 'Places',     civilian: 'Hospital',     imposter: 'Clinic'        },
  { category: 'Places',     civilian: 'Museum',       imposter: 'Art Gallery'   },
  { category: 'Places',     civilian: 'Casino',       imposter: 'Arcade'        },
  { category: 'Places',     civilian: 'Lighthouse',   imposter: 'Watchtower'    },
  { category: 'Places',     civilian: 'Circus',       imposter: 'Carnival'      },

  // Sports
  { category: 'Sports',     civilian: 'Football',     imposter: 'Rugby'         },
  { category: 'Sports',     civilian: 'Tennis',       imposter: 'Badminton'     },
  { category: 'Sports',     civilian: 'Swimming',     imposter: 'Diving'        },
  { category: 'Sports',     civilian: 'Basketball',   imposter: 'Volleyball'    },
  { category: 'Sports',     civilian: 'Skiing',       imposter: 'Snowboarding'  },
  { category: 'Sports',     civilian: 'Boxing',       imposter: 'Kickboxing'    },
  { category: 'Sports',     civilian: 'Surfing',      imposter: 'Wakeboarding'  },
  { category: 'Sports',     civilian: 'Golf',         imposter: 'Croquet'       },

  // Professions
  { category: 'Professions', civilian: 'Surgeon',     imposter: 'Dentist'       },
  { category: 'Professions', civilian: 'Astronaut',   imposter: 'Pilot'         },
  { category: 'Professions', civilian: 'Detective',   imposter: 'Police Officer'},
  { category: 'Professions', civilian: 'Chef',        imposter: 'Baker'         },
  { category: 'Professions', civilian: 'Architect',   imposter: 'Interior Designer'},
  { category: 'Professions', civilian: 'Magician',    imposter: 'Illusionist'   },
  { category: 'Professions', civilian: 'Firefighter', imposter: 'Paramedic'     },
  { category: 'Professions', civilian: 'Journalist',  imposter: 'News Anchor'   },

  // Objects
  { category: 'Objects',    civilian: 'Telescope',    imposter: 'Microscope'    },
  { category: 'Objects',    civilian: 'Compass',      imposter: 'Sundial'       },
  { category: 'Objects',    civilian: 'Hourglass',    imposter: 'Stopwatch'     },
  { category: 'Objects',    civilian: 'Anchor',       imposter: 'Grappling Hook'},
  { category: 'Objects',    civilian: 'Magnifying Glass', imposter: 'Binoculars'},
  { category: 'Objects',    civilian: 'Suitcase',     imposter: 'Backpack'      },
  { category: 'Objects',    civilian: 'Candle',       imposter: 'Torch'         },
  { category: 'Objects',    civilian: 'Piano',        imposter: 'Organ'         },
];

export function pickRandomPair(): WordPair {
  const idx = Math.floor(Math.random() * WORD_PAIRS.length);
  return WORD_PAIRS[idx];
}
