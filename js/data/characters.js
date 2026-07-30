/**
 * Static character database for FNAF-Verse.
 *
 * Covers every animatronic appearing in Five Nights at Freddy's 1 through 4,
 * listed in chronological release order. Descriptions are written from scratch
 * based on the factual content documented on the FNAF Wiki (appearance,
 * mechanics, behaviour) — nothing here is fetched at runtime.
 *
 * Shape of a character entry:
 *   id              stable slug; also the asset filename stem
 *   name            display name
 *   game            1 | 2 | 3 | 4
 *   type            category slug, see TYPES below
 *   aliases         extra strings the search should match on
 *   tagline         one short line used under the name
 *   description     2-4 sentences of body copy
 *   firstAppearance human-readable debut
 *   trivia          short bullet facts
 */

export const GAMES = [
  {
    id: 1,
    key: 'fnaf1',
    title: "Five Nights at Freddy's",
    year: '2014',
    setting: "Freddy Fazbear's Pizza — 1993",
    blurb:
      'A dying family pizzeria, four animatronics with a free-roaming mode, and two ' +
      'doors on a finite power budget. The one that started it all.',
    accent: '#c2410c',
    scene: 'fnaf1-office',
    ambience: 'fnaf1',
  },
  {
    id: 2,
    key: 'fnaf2',
    title: "Five Nights at Freddy's 2",
    year: '2014',
    setting: "Freddy Fazbear's Pizza — 1987",
    blurb:
      'A prequel with no doors at all. A shiny new Toy cast, the battered originals ' +
      'shoved into Parts & Service, and a music box that must never stop playing.',
    accent: '#0e7490',
    scene: 'fnaf2-stage',
    ambience: 'fnaf2',
  },
  {
    id: 3,
    key: 'fnaf3',
    title: "Five Nights at Freddy's 3",
    year: '2015',
    setting: "Fazbear's Fright: The Horror Attraction — 2023",
    blurb:
      'Thirty years later the pizzeria is a horror attraction. Only one animatronic ' +
      'is real, and the rest are hallucinations that exist to make you look away.',
    accent: '#4d7c0f',
    scene: 'fnaf3-office',
    ambience: 'fnaf3',
  },
  {
    id: 4,
    key: 'fnaf4',
    title: "Five Nights at Freddy's 4",
    year: '2015',
    setting: 'A child’s bedroom — 1983',
    blurb:
      'No cameras, no power meter. Just a flashlight, two hallways, a closet, and the ' +
      'need to listen for breathing before you dare open a door.',
    accent: '#7e22ce',
    scene: 'fnaf4-bedroom',
    ambience: 'fnaf4',
  },
];

export const TYPES = [
  { id: 'classic', label: 'Classic' },
  { id: 'toy', label: 'Toys' },
  { id: 'withered', label: 'Withered' },
  { id: 'phantom', label: 'Phantoms' },
  { id: 'nightmare', label: 'Nightmares' },
  { id: 'shadow', label: 'Shadows' },
  { id: 'springlock', label: 'Springlock' },
  { id: 'endo', label: 'Endoskeletons' },
  { id: 'halloween', label: 'Halloween' },
];

export const CHARACTERS = [
  /* ------------------------------------------------------------------ FNAF 1 */
  {
    id: 'freddy-fazbear',
    name: 'Freddy Fazbear',
    game: 1,
    type: 'classic',
    aliases: ['freddy', 'fazbear', 'lead singer'],
    tagline: 'The face of the franchise.',
    description:
      'The animatronic mascot and lead singer of the band, a brown bear in a black top ' +
      'hat and bow tie who performs on the Show Stage with a microphone in his right hand. ' +
      'Freddy is the most patient of the four: he holds his position long after Bonnie and ' +
      'Chica have left, and only becomes seriously active from the third night onward. ' +
      'He moves almost exclusively in darkness, announcing each relocation with a low ' +
      'distorted laugh, and closes in on the office from the East Hall.',
    firstAppearance: "Five Nights at Freddy's (2014)",
    trivia: [
      'Cannot move while the East Hall camera is being actively watched.',
      'If the power runs out he appears in the doorway playing the Toreador March.',
      'His laugh is a pitch-shifted recording of a child laughing.',
    ],
  },
  {
    id: 'bonnie',
    name: 'Bonnie',
    game: 1,
    type: 'classic',
    aliases: ['bonnie the rabbit', 'bunny', 'guitarist'],
    tagline: 'Guitarist. Never uses the vents. Never needs to.',
    description:
      'A lavender rabbit with a red bow tie who plays guitar on stage beside Freddy. ' +
      'Bonnie is typically the first animatronic to leave the Show Stage and the most ' +
      'aggressive early in the week, working his way toward the office along the west ' +
      'side of the building. He can appear directly in the West Hall Corner and then in ' +
      'the left doorway itself, which is the cue to shut the door immediately.',
    firstAppearance: "Five Nights at Freddy's (2014)",
    trivia: [
      'Unlike most of the cast he is capable of appearing inside the office doorway.',
      'He is one of only two characters who can enter the Backstage room.',
      'His original design gives him a squared, blocky muzzle unique among the classics.',
    ],
  },
  {
    id: 'chica',
    name: 'Chica',
    game: 1,
    type: 'classic',
    aliases: ['chica the chicken', 'chicken', 'lets eat'],
    tagline: 'Backup singer with a bib that reads "LET’S EAT!!!"',
    description:
      'A yellow chicken who sings backup and carries a cupcake on a plate. Her bib ' +
      'reads "LET’S EAT!!!" and her beak is capable of opening far wider than it ' +
      'should. Chica mirrors Bonnie on the opposite side of the building, approaching ' +
      'through the dining area and East Hall, and she has a habit of wandering into the ' +
      'Kitchen — a camera with no working video feed, leaving only audio of clattering pans.',
    firstAppearance: "Five Nights at Freddy's (2014)",
    trivia: [
      'The Kitchen camera is audio-only, a limitation the game turns into a mechanic.',
      'A second set of teeth is visible inside her mouth, belonging to the endoskeleton.',
      'Her cupcake follows her between rooms and sits on the office desk.',
    ],
  },
  {
    id: 'foxy',
    name: 'Foxy',
    game: 1,
    type: 'classic',
    aliases: ['foxy the pirate fox', 'pirate cove', 'fox'],
    tagline: 'Out of Order. Do not look away.',
    description:
      'A crimson fox with an eyepatch, a hook for a right hand and torn fabric exposing ' +
      'the endoskeleton beneath. Foxy waits behind the curtain in Pirate Cove, a stage ' +
      'closed to the public and marked "Out of Order". He does not stalk the halls like ' +
      'the others — instead he emerges in stages if the cameras are left unwatched, then ' +
      'sprints down the West Hall, and only a door closed in time will stop him.',
    firstAppearance: "Five Nights at Freddy's (2014)",
    trivia: [
      'Checking Pirate Cove too often is also punished — he is provoked by both extremes.',
      'Blocking his charge with the door still drains a chunk of power as he bangs on it.',
      'He is the only classic animatronic who runs rather than walks.',
    ],
  },
  {
    id: 'golden-freddy',
    name: 'Golden Freddy',
    game: 1,
    type: 'classic',
    aliases: ['goldie', 'yellow bear', 'fredbear'],
    tagline: 'It’s me.',
    description:
      'A hollow golden-yellow bear that sits slumped on the office floor, mouth open and ' +
      'eye sockets empty except for two faint pinpricks of light. Golden Freddy is not ' +
      'summoned by any camera route; he simply appears after a specific poster in the West ' +
      'Hall Corner changes to his face. Raising the monitor makes him vanish. Failing to ' +
      'do so crashes the game outright.',
    firstAppearance: "Five Nights at Freddy's (2014)",
    trivia: [
      'His limp, boneless posture implies he has no endoskeleton inside the suit.',
      'He is the only character in the first game whose "kill" closes the application.',
      'Typing 1-9-8-7 on the Custom Night screen summons him directly.',
    ],
  },
  {
    id: 'endo-01',
    name: 'Endo-01',
    game: 1,
    type: 'endo',
    aliases: ['endoskeleton', 'endo one', 'backstage'],
    tagline: 'The frame every suit is built around.',
    description:
      'The bare metal endoskeleton used inside the original animatronic suits, kept ' +
      'upright in the Backstage room among spare heads and parts. Endo-01 never leaves ' +
      'that room and never attacks, but it will subtly change pose between camera checks ' +
      'and can turn to face the lens. It exists mainly to establish the rule the phone ' +
      'calls keep repeating: an endoskeleton without a costume gets stuffed into one.',
    firstAppearance: "Five Nights at Freddy's (2014)",
    trivia: [
      'It is one of very few characters that is genuinely harmless.',
      'Bonnie and Chica are the only animatronics that visit its room.',
      'Its design is the visible skeleton underneath all four classic suits.',
    ],
  },
  {
    id: 'mr-cupcake',
    name: 'Mr. Cupcake',
    game: 1,
    type: 'classic',
    aliases: ['cupcake', 'carl the cupcake', 'chicas cupcake'],
    tagline: 'Chica’s inseparable companion.',
    description:
      'A pink-frosted cupcake with a candle, two googly eyes and a pair of buck teeth, ' +
      'carried by Chica on a plate. It relocates alongside her and, once she has left the ' +
      'stage, takes up residence on the desk in the office where it stares at the player ' +
      'for the rest of the night. Harmless in the first game, it graduates to a genuine ' +
      'threat in later entries.',
    firstAppearance: "Five Nights at Freddy's (2014)",
    trivia: [
      'It appears on the office desk regardless of where Chica currently is.',
      'A second cupcake sits in the Show Stage room on a table.',
      'Its Nightmare counterpart becomes an actual attacker in the fourth game.',
    ],
  },

  /* ------------------------------------------------------------------ FNAF 2 */
  {
    id: 'toy-freddy',
    name: 'Toy Freddy',
    game: 2,
    type: 'toy',
    aliases: ['toy freddy fazbear', 'new freddy'],
    tagline: 'Glossy, rosy-cheeked, and quietly furious.',
    description:
      'The refurbished 1987 replacement for Freddy: a shorter, rounder bear with a ' +
      'high-gloss plastic shell, rosy cheeks and bright blue eyes. Toy Freddy stays on ' +
      'the Show Stage longer than his bandmates and tends to be the last of the Toys to ' +
      'become active, making his way to the office through the main hall rather than the ' +
      'vents. The Freddy head is the only defence against him.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'He holds a microphone in his left hand, mirroring the original Freddy.',
      'Unlike Toy Bonnie and Toy Chica he never uses the air vents.',
      'His eyes turn to black sockets with white pinpricks in certain rooms.',
    ],
  },
  {
    id: 'toy-bonnie',
    name: 'Toy Bonnie',
    game: 2,
    type: 'toy',
    aliases: ['toy bonnie the rabbit', 'blue bonnie', 'bonbon'],
    tagline: 'Bright blue, green-eyed, and fond of vents.',
    description:
      'A sleek electric-blue rabbit with green eyes, a red bow tie and a matching guitar. ' +
      'Toy Bonnie approaches the office through the right air vent, and the vent blind ' +
      'spot beside the desk means he can be inches away without appearing on any camera. ' +
      'Wearing the Freddy Fazbear head convinces him the office is empty and sends him away.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'His faceplate can open, revealing the endoskeleton underneath.',
      'He is one of the few animatronics with visible eyelashes and painted nails.',
      'The Freddy head is the only counter — there are no doors in this game.',
    ],
  },
  {
    id: 'toy-chica',
    name: 'Toy Chica',
    game: 2,
    type: 'toy',
    aliases: ['toy chica the chicken', 'lets party', 'beakless'],
    tagline: 'Leaves her beak and her eyes on the stage.',
    description:
      'A bright yellow chicken with orange legs, a "LET’S PARTY!" bib and a cupcake ' +
      'of her own. Her defining quirk is that she removes her beak and eyes the moment she ' +
      'steps off the Show Stage, so the version that reaches the office is an eyeless, ' +
      'beakless face on an otherwise cheerful body. She travels down the left air vent.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'She only ever has her beak on while standing on the Show Stage.',
      'The removed parts are never shown lying anywhere in the building.',
      'Her cupcake sits on the stage beside her at the start of each night.',
    ],
  },
  {
    id: 'mangle',
    name: 'Mangle',
    game: 2,
    type: 'toy',
    aliases: ['toy foxy', 'funtime foxy', 'kids cove', 'the mangle'],
    tagline: 'Take-apart-and-put-back-together attraction.',
    description:
      'Originally a white-and-pink Toy Foxy built for Kid’s Cove, Mangle was ' +
      'dismantled so thoroughly and so often by children that staff gave up reassembling ' +
      'it. What remains is a tangle of wire, limbs and two heads that crawls along ceilings ' +
      'and walls. It reaches the office through the right air vent and fills the room with ' +
      'garbled radio static once it arrives.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'Its persistent radio interference is audible long before it strikes.',
      'The staff eventually rebranded the wreck as a take-apart attraction.',
      'Its gender is deliberately left ambiguous by the in-game phone calls.',
    ],
  },
  {
    id: 'balloon-boy',
    name: 'Balloon Boy',
    game: 2,
    type: 'toy',
    aliases: ['bb', 'balloon', 'hello hi'],
    tagline: '"Hello!" — the most hated word in the series.',
    description:
      'A humanoid child animatronic in a striped shirt and propeller cap, holding a ' +
      'balloon in one hand and a sign reading "Balloons!" in the other. Balloon Boy never ' +
      'kills the player himself. He climbs the left air vent into the office and disables ' +
      'the flashlight entirely, which leaves the hallway unlit and Foxy free to advance ' +
      'unchecked. His giggle is the only warning.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'He is one of the only animatronics that cannot directly end the night.',
      'Once inside the office he cannot be removed for the rest of the night.',
      'He speaks two lines of dialogue: "Hello!" and "Hi!"',
    ],
  },
  {
    id: 'jj',
    name: 'JJ',
    game: 2,
    type: 'toy',
    aliases: ['balloon girl', 'bg', 'jay jay'],
    tagline: 'Balloon Boy’s counterpart, hiding under the desk.',
    description:
      'A purple-and-blue variant of Balloon Boy with a different hairstyle and no ' +
      'propeller cap. JJ does not travel the vents in the main game — she simply appears ' +
      'crouched under the office desk, visible only when the flashlight is aimed low. ' +
      'In the Custom Night she disables the Freddy head and the vent doors, stripping away ' +
      'the player’s defences rather than attacking directly.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'Her presence in the base game is a rare, largely cosmetic easter egg.',
      'She is widely nicknamed "Balloon Girl" despite the initials JJ.',
      'Like Balloon Boy she is a saboteur rather than a killer.',
    ],
  },
  {
    id: 'the-puppet',
    name: 'The Puppet',
    game: 2,
    type: 'toy',
    aliases: ['marionette', 'puppet', 'music box', 'prize corner'],
    tagline: 'Wind the music box. Always wind the music box.',
    description:
      'A tall, thin marionette with a white mask, purple tear streaks, red cheeks and ' +
      'three buttons down its chest. The Puppet sits inside a present box in the Prize ' +
      'Corner and is held there by a wind-up music box that steadily unwinds all night. ' +
      'Keeping it wound is a constant tax on the player’s attention, and if the music ' +
      'ever stops the Puppet emerges — at which point nothing can prevent the attack.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'The music box plays "My Grandfather’s Clock".',
      'It is the only threat with no counter once it has left the box.',
      'The Give Gifts, Give Life minigame frames it as protective rather than hostile.',
    ],
  },
  {
    id: 'withered-freddy',
    name: 'Withered Freddy',
    game: 2,
    type: 'withered',
    aliases: ['old freddy', 'withered'],
    tagline: 'The 1993 Freddy, decades before we met him.',
    description:
      'The original Freddy suit after years of service: torn fabric, exposed wiring at ' +
      'the joints and a jaw that no longer closes properly. Withered Freddy is kept in ' +
      'Parts & Service alongside the other decommissioned originals and approaches the ' +
      'office down the main hall. Like the Toys, he is fooled by the Freddy Fazbear head.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'His endoskeleton fingers are visible through the ruined hands.',
      'He is noticeably less active than Withered Bonnie and Withered Chica.',
      'Chronologically this is the earlier version of the FNAF 1 Freddy.',
    ],
  },
  {
    id: 'withered-bonnie',
    name: 'Withered Bonnie',
    game: 2,
    type: 'withered',
    aliases: ['old bonnie', 'faceless bonnie', 'bonnie no face'],
    tagline: 'No face. No left arm. Still coming.',
    description:
      'Easily the most damaged of the withered set: his entire face has been removed, ' +
      'leaving a bare endoskeleton skull staring out of a purple suit, and his left ' +
      'forearm is missing outright. He advances on the office through the left air vent ' +
      'and the main hall, and his silhouette in the darkness is one of the most ' +
      'recognisable images in the series.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'His removed face is never found anywhere in the building.',
      'He is among the most aggressive animatronics on the later nights.',
      'The exposed skull is the same endoskeleton head seen in Parts & Service.',
    ],
  },
  {
    id: 'withered-chica',
    name: 'Withered Chica',
    game: 2,
    type: 'withered',
    aliases: ['old chica', 'chica no hands', 'broken jaw'],
    tagline: 'Arms locked open, hands long gone.',
    description:
      'The decommissioned original Chica, whose arms are permanently locked in a wide ' +
      'outward position and whose hands have been torn away, leaving only frayed wiring. ' +
      'Her jaw hangs unnaturally wide, splitting her face into a gaping double-mouth. ' +
      'She uses the right air vent to reach the office and is one of the earliest ' +
      'withered animatronics to activate.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'The wide-open arms are a result of the endoskeleton locking up, not damage.',
      'Her bib still reads "LET’S EAT!!!" beneath the grime.',
      'She has no cupcake in this incarnation.',
    ],
  },
  {
    id: 'withered-foxy',
    name: 'Withered Foxy',
    game: 2,
    type: 'withered',
    aliases: ['old foxy', 'parts and service foxy'],
    tagline: 'Kept in Parts & Service and still fast.',
    description:
      'The original Foxy, even more tattered than the version seen in 1993, stored in ' +
      'Parts & Service with the other retired suits. He advances down the main hall in ' +
      'stages and cannot be repelled by the Freddy head — the only counter is a sharp ' +
      'burst of the flashlight, which stalls him and buys the player a few more seconds.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'The Freddy head does not work on him, breaking the game’s core rule.',
      'Repeated flashlight bursts are the intended defence.',
      'His hook and eyepatch survive intact despite the damage elsewhere.',
    ],
  },
  {
    id: 'shadow-freddy',
    name: 'Shadow Freddy',
    game: 2,
    type: 'shadow',
    aliases: ['purple freddy', 'shadow bear'],
    tagline: 'A purple silhouette that should not be there.',
    description:
      'A dark purple, faintly translucent Freddy with glowing white eyes and teeth who ' +
      'appears seated in Parts & Service, in the spot normally occupied by Golden Freddy. ' +
      'He is a rare random event rather than a scheduled threat. Looking at him for too ' +
      'long causes the game to crash, and he never appears on any camera other than that ' +
      'one room.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'Staring too long crashes the game rather than triggering an attack.',
      'His model is a recoloured Golden Freddy, not a recoloured Freddy.',
      'He also appears as a guide figure in several of the game’s minigames.',
    ],
  },
  {
    id: 'rwqfsfasxc',
    name: 'RWQFSFASXC',
    game: 2,
    type: 'shadow',
    aliases: ['shadow bonnie', 'shadow toy bonnie', 'rwq'],
    tagline: 'The unpronounceable one.',
    description:
      'A near-black silhouette of Toy Bonnie with glowing white eyes, named after the ' +
      'garbled filename used in the game’s own files. RWQFSFASXC appears standing in ' +
      'the left-hand corner of the office as a random event, and as with Shadow Freddy, ' +
      'lingering on him causes a crash. He is a pure atmosphere piece with no bearing on ' +
      'whether the night is survived.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'The name is the literal filename of the sprite in the game’s assets.',
      'He appears in the office itself rather than on a camera feed.',
      'He later becomes a playable character in FNaF World.',
    ],
  },
  {
    id: 'endo-02',
    name: 'Endo-02',
    game: 2,
    type: 'endo',
    aliases: ['endoskeleton 2', 'toy endoskeleton'],
    tagline: 'The chassis inside the Toys.',
    description:
      'The second-generation endoskeleton, built to a sleeker and more humanlike ' +
      'specification than Endo-01 and used as the frame for the Toy animatronics. Several ' +
      'units stand unfinished in Parts & Service throughout the second game. Like its ' +
      'predecessor it poses no threat, existing to show what is underneath the plastic ' +
      'shells the rest of the cast wear.',
    firstAppearance: "Five Nights at Freddy's 2 (2014)",
    trivia: [
      'Its faceplate design matches the openable faces of the Toy animatronics.',
      'It appears in the background of Parts & Service, never in the office.',
      'The Toys’ facial recognition hardware is built into this frame.',
    ],
  },

  /* ------------------------------------------------------------------ FNAF 3 */
  {
    id: 'springtrap',
    name: 'Springtrap',
    game: 3,
    type: 'springlock',
    aliases: ['william afton', 'spring bonnie', 'purple guy', 'the one you should not have killed'],
    tagline: 'The only one that is real.',
    description:
      'A decayed greenish-yellow rabbit suit with torn limbs, exposed springlock hardware ' +
      'and a human corpse still visible inside it. Springtrap is the sole physical ' +
      'animatronic in Fazbear’s Fright and the only genuine threat in the game; ' +
      'everything else is a hallucination. He is lured between rooms with audio cues and ' +
      'stalled by sealing vents, but he cannot be stopped, only delayed.',
    firstAppearance: "Five Nights at Freddy's 3 (2015)",
    trivia: [
      'Audio lures and vent seals are the only tools available against him.',
      'The body inside the suit is visible through the tears in the costume.',
      'He is the direct result of the springlock failure shown in the game’s ending.',
    ],
  },
  {
    id: 'phantom-freddy',
    name: 'Phantom Freddy',
    game: 3,
    type: 'phantom',
    aliases: ['burnt freddy', 'phantom bear'],
    tagline: 'Walks past the window, charred and smoking.',
    description:
      'A blackened, burnt-out Freddy with glowing white pinprick eyes who slowly walks ' +
      'across the office window from left to right. He cannot harm the player directly, ' +
      'but letting him complete his walk triggers a jumpscare that disables the ventilation ' +
      'system — and a failing ventilation system is what eventually kills you.',
    firstAppearance: "Five Nights at Freddy's 3 (2015)",
    trivia: [
      'Lowering the monitor while he is mid-walk avoids the scare entirely.',
      'Every phantom exists to sabotage a system rather than end the night.',
      'The burnt texture implies the fire that destroyed the original location.',
    ],
  },
  {
    id: 'phantom-chica',
    name: 'Phantom Chica',
    game: 3,
    type: 'phantom',
    aliases: ['burnt chica', 'arcade chica'],
    tagline: 'Waiting inside an arcade cabinet.',
    description:
      'A scorched Chica whose face fills the screen of an arcade machine on one of the ' +
      'cameras. Looking at that camera for more than a moment triggers her scare, which ' +
      'knocks out the ventilation and leaves the player disoriented while Springtrap keeps ' +
      'moving. Like all phantoms she never physically enters the office.',
    firstAppearance: "Five Nights at Freddy's 3 (2015)",
    trivia: [
      'She appears on the arcade cabinet in CAM 07.',
      'Her scare disables ventilation, not audio.',
      'Switching cameras quickly is enough to avoid her.',
    ],
  },
  {
    id: 'phantom-foxy',
    name: 'Phantom Foxy',
    game: 3,
    type: 'phantom',
    aliases: ['burnt foxy', 'phantom fox'],
    tagline: 'Standing to your left when you look up.',
    description:
      'A charred, hollow-eyed Foxy who materialises in the left-hand corner of the office ' +
      'itself rather than on a camera. He appears while the monitor is down, and the ' +
      'moment the player’s view sweeps over him he lunges, cutting the ventilation. ' +
      'Raising the monitor immediately after he spawns is the standard way to dodge him.',
    firstAppearance: "Five Nights at Freddy's 3 (2015)",
    trivia: [
      'He is one of the few phantoms that appears inside the office.',
      'Looking away and pulling up the monitor defuses him.',
      'His model is a burnt recolour of the FNAF 1 Foxy.',
    ],
  },
  {
    id: 'phantom-balloon-boy',
    name: 'Phantom Balloon Boy',
    game: 3,
    type: 'phantom',
    aliases: ['phantom bb', 'burnt balloon boy'],
    tagline: 'Still says hello. Still ruins everything.',
    description:
      'A blackened Balloon Boy with white glowing eyes who first appears on a camera feed ' +
      'and then rushes the office. His scare knocks out the ventilation system, and given ' +
      'how quickly oxygen deprivation escalates into hallucinations, he is considered one ' +
      'of the more dangerous phantoms despite being unable to kill.',
    firstAppearance: "Five Nights at Freddy's 3 (2015)",
    trivia: [
      'He appears on the cameras before appearing in the office.',
      'His scare is among the loudest in the game.',
      'The original Balloon Boy’s sabotage role carries over intact.',
    ],
  },
  {
    id: 'phantom-mangle',
    name: 'Phantom Mangle',
    game: 3,
    type: 'phantom',
    aliases: ['burnt mangle', 'phantom toy foxy'],
    tagline: 'Static that never quite stops.',
    description:
      'The burnt remains of Mangle, appearing on camera as a tangle of scorched parts ' +
      'before screeching directly at the player. Rather than the ventilation, her scare ' +
      'disables the audio system used to lure Springtrap away, and she leaves behind a ' +
      'wash of radio interference that makes tracking him considerably harder.',
    firstAppearance: "Five Nights at Freddy's 3 (2015)",
    trivia: [
      'Uniquely among the phantoms she disables the audio lure, not ventilation.',
      'Her interference noise persists after the scare ends.',
      'She hangs from the ceiling in the office window during her appearance.',
    ],
  },
  {
    id: 'phantom-puppet',
    name: 'Phantom Puppet',
    game: 3,
    type: 'phantom',
    aliases: ['phantom marionette', 'burnt puppet'],
    tagline: 'Fills the screen and refuses to leave.',
    description:
      'A charred, hollow-eyed version of the Puppet that appears floating in the office ' +
      'and blocks the player’s entire field of view. It does not damage any system, ' +
      'but the obstruction lasts far longer than any other phantom encounter, leaving ' +
      'Springtrap free to close the distance completely unobserved.',
    firstAppearance: "Five Nights at Freddy's 3 (2015)",
    trivia: [
      'Its scare blocks the screen instead of disabling a system.',
      'The duration of the block is what makes it dangerous.',
      'It is triggered by lingering on the camera where it appears.',
    ],
  },

  /* ------------------------------------------------------------------ FNAF 4 */
  {
    id: 'nightmare-freddy',
    name: 'Nightmare Freddy',
    game: 4,
    type: 'nightmare',
    aliases: ['nightmare bear', 'freddles freddy'],
    tagline: 'Never in the halls. Always on the bed.',
    description:
      'A hulking, razor-toothed Freddy with tattered fur, oversized claws and three ' +
      'miniature versions of himself growing out of his torso. He does not use either ' +
      'hallway — instead the Freddles accumulate on the bed behind the player, and once ' +
      'enough have gathered he manifests there directly. Turning and shining the ' +
      'flashlight on the bed clears them before that happens.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'He is the only nightmare that attacks from the bed rather than a door.',
      'Each Freddle removed resets a little of his progress.',
      'His teeth are modelled on those of the Fredbear plush.',
    ],
  },
  {
    id: 'freddles',
    name: 'Freddles',
    game: 4,
    type: 'nightmare',
    aliases: ['mini freddies', 'freddle'],
    tagline: 'Three at a time, and then it is too late.',
    description:
      'Small, sharp-toothed miniatures of Nightmare Freddy that appear one at a time on ' +
      'the bed behind the player. Individually harmless, they are a countdown: once three ' +
      'have accumulated Nightmare Freddy himself materialises. They are cleared by turning ' +
      'to the bed and using the flashlight, which forces the player to abandon the ' +
      'hallways for a few seconds.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'They also cling to Nightmare Freddy’s chest and arms.',
      'Their giggling is audible before they become visible.',
      'They are the game’s only "swarm" mechanic.',
    ],
  },
  {
    id: 'nightmare-bonnie',
    name: 'Nightmare Bonnie',
    game: 4,
    type: 'nightmare',
    aliases: ['nightmare rabbit', 'nightmare bunny'],
    tagline: 'Left door. Listen before you look.',
    description:
      'A towering, skeletal blue rabbit with three rows of teeth, torn ears and exposed ' +
      'ribbing. Nightmare Bonnie approaches exclusively down the left hallway. The correct ' +
      'response depends entirely on sound: listen at the door, and if breathing is audible, ' +
      'hold the door shut; if not, a flashlight burst down the hall drives him back.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'Shining the light on him at the door is fatal — the door must be closed instead.',
      'His breathing is the single most important audio cue in the game.',
      'He and Nightmare Chica share identical mechanics on opposite sides.',
    ],
  },
  {
    id: 'nightmare-chica',
    name: 'Nightmare Chica',
    game: 4,
    type: 'nightmare',
    aliases: ['nightmare chicken'],
    tagline: 'Right door, and she brought the cupcake.',
    description:
      'A gaunt yellow chicken with an enormous secondary set of teeth and a bib hanging ' +
      'in shreds. She mirrors Nightmare Bonnie exactly, approaching down the right hallway ' +
      'and demanding the same listen-then-decide response. She also brings Nightmare ' +
      'Cupcake, which can attack from the doorway independently of her.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'Her cupcake is a genuinely separate threat in this game.',
      'Her upper beak is split into two rows of teeth.',
      'She is only ever encountered on the right side of the bedroom.',
    ],
  },
  {
    id: 'nightmare-cupcake',
    name: 'Nightmare Cupcake',
    game: 4,
    type: 'nightmare',
    aliases: ['nightmare mr cupcake', 'evil cupcake'],
    tagline: 'The cupcake finally bites back.',
    description:
      'A grotesque version of Chica’s cupcake with a mouthful of jagged teeth and ' +
      'bloodshot eyes. Unlike its harmless 1993 counterpart it is a live threat, lunging ' +
      'at the player from the right doorway when the flashlight is used carelessly. It ' +
      'travels with Nightmare Chica but strikes on its own schedule.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'It is the only prop in the series promoted to a full attacker.',
      'It sits on the floor by the right door before it strikes.',
      'Its scare is one of the shortest in the game.',
    ],
  },
  {
    id: 'nightmare-foxy',
    name: 'Nightmare Foxy',
    game: 4,
    type: 'nightmare',
    aliases: ['nightmare fox', 'closet foxy'],
    tagline: 'Lives in the closet. Becomes a plush when watched.',
    description:
      'A skeletal red fox with a hook, a shredded muzzle and exposed metal jaws. Nightmare ' +
      'Foxy ignores both hallways and instead occupies the bedroom closet, advancing ' +
      'through several stages each time the player looks away. Shining the flashlight on ' +
      'him mid-stage reverts him into a harmless Foxy plush sitting on the closet floor.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'He is the only nightmare that can be reverted to a plush toy.',
      'Leaving the closet door open too long lets him escape into the room.',
      'His approach is tracked in four distinct visual stages.',
    ],
  },
  {
    id: 'nightmare-fredbear',
    name: 'Nightmare Fredbear',
    game: 4,
    type: 'nightmare',
    aliases: ['fredbear', 'yellow nightmare', 'golden nightmare'],
    tagline: 'On Night 5 he replaces everyone.',
    description:
      'A golden-yellow bear in a purple top hat and bow tie, larger and considerably ' +
      'faster than the rest of the nightmare cast. From the fifth night onward he is the ' +
      'only animatronic present, attacking from both hallways, the closet and the bed in ' +
      'turn. The player must handle every position alone with no margin for a mistake.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'He replaces the entire cast rather than joining it.',
      'A second set of teeth sits inside his stomach.',
      'His plush counterpart speaks to the child between nights.',
    ],
  },
  {
    id: 'nightmare',
    name: 'Nightmare',
    game: 4,
    type: 'nightmare',
    aliases: ['black fredbear', 'shadow fredbear', 'night 6'],
    tagline: 'Fredbear, drained of all colour.',
    description:
      'A pure black version of Nightmare Fredbear with faintly glowing teeth, eyes and ' +
      'accents, appearing from the sixth night onward. He follows the same all-positions ' +
      'pattern as Fredbear but moves faster still, and his near-invisibility in the ' +
      'unlit hallways makes the flashlight essential rather than optional.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'He is functionally Nightmare Fredbear with a harder difficulty curve.',
      'Only his teeth and eyes are clearly visible in the dark.',
      'He appears alongside Fredbear on the final night.',
    ],
  },
  {
    id: 'plushtrap',
    name: 'Plushtrap',
    game: 4,
    type: 'nightmare',
    aliases: ['plush springtrap', 'fun with plushtrap', 'chair'],
    tagline: 'Fun with Plushtrap. Catch him on the X.',
    description:
      'A small green rabbit plush with sharp teeth and glowing eyes who appears in the ' +
      'hallway minigame between nights. Plushtrap sits on a chair at the end of a dark ' +
      'corridor and creeps forward whenever the flashlight is off. Catching him standing ' +
      'exactly on the X marked on the floor shortens the following night by two hours.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'Winning his minigame skips the next night ahead to 3 AM.',
      'He only moves while the flashlight is switched off.',
      'His design foreshadows Springtrap’s.',
    ],
  },
  {
    id: 'nightmarionne',
    name: 'Nightmarionne',
    game: 4,
    type: 'halloween',
    aliases: ['nightmare puppet', 'nightmare marionette', 'halloween'],
    tagline: 'Halloween Edition. All limbs, no mercy.',
    description:
      'A spindly, monochrome nightmare interpretation of the Puppet with elongated limbs, ' +
      'clawed fingers and a jagged grin. Added in the Halloween Edition update, ' +
      'Nightmarionne takes the place of Nightmare on the later nights, keeping the same ' +
      'all-positions behaviour while being substantially harder to see in the dark.',
    firstAppearance: "Five Nights at Freddy's 4: Halloween Edition (2015)",
    trivia: [
      'It replaces Nightmare rather than being added alongside him.',
      'Its striped limbs make it blend into the bedroom shadows.',
      'The Halloween Edition swapped in several such variants at once.',
    ],
  },
  {
    id: 'nightmare-balloon-boy',
    name: 'Nightmare Balloon Boy',
    game: 4,
    type: 'halloween',
    aliases: ['nightmare bb', 'halloween bb'],
    tagline: 'The minigame, but worse.',
    description:
      'A nightmare version of Balloon Boy with a permanently fixed grin full of teeth, ' +
      'introduced in the Halloween Edition. He takes Plushtrap’s place in the hallway ' +
      'minigame, following the same stop-and-start approach while the flashlight is off, ' +
      'and he can also appear in the bedroom itself during the nights.',
    firstAppearance: "Five Nights at Freddy's 4: Halloween Edition (2015)",
    trivia: [
      'He substitutes for Plushtrap in the between-night minigame.',
      'His proportions are far larger than the original Balloon Boy’s.',
      'He is one of the few Halloween variants to appear outside the minigame.',
    ],
  },
  {
    id: 'jack-o-bonnie',
    name: 'Jack-O-Bonnie',
    game: 4,
    type: 'halloween',
    aliases: ['halloween bonnie', 'pumpkin bonnie'],
    tagline: 'Nightmare Bonnie, lit from within.',
    description:
      'A Halloween Edition recolour of Nightmare Bonnie rendered in black with an intense ' +
      'orange internal glow, as though a jack-o-lantern had been lit inside the suit. He ' +
      'replaces Nightmare Bonnie entirely and behaves identically, approaching down the ' +
      'left hallway and responding to the same breathing cue.',
    firstAppearance: "Five Nights at Freddy's 4: Halloween Edition (2015)",
    trivia: [
      'His mechanics are unchanged from Nightmare Bonnie’s.',
      'The glow makes him easier to spot but no easier to survive.',
      'He and Jack-O-Chica were introduced in the same update.',
    ],
  },
  {
    id: 'jack-o-chica',
    name: 'Jack-O-Chica',
    game: 4,
    type: 'halloween',
    aliases: ['halloween chica', 'pumpkin chica'],
    tagline: 'Nightmare Chica in pumpkin orange.',
    description:
      'The Halloween Edition counterpart to Nightmare Chica, blackened and glowing orange ' +
      'from the inside out, accompanied by a matching jack-o-lantern cupcake. She replaces ' +
      'Nightmare Chica on the right hallway and plays by exactly the same rules, making ' +
      'the update a purely cosmetic reskin of an already brutal night.',
    firstAppearance: "Five Nights at Freddy's 4: Halloween Edition (2015)",
    trivia: [
      'Her cupcake receives a matching Halloween redesign.',
      'She grows dramatically larger during her jumpscare.',
      'The Halloween Edition was released as a free update.',
    ],
  },
  {
    id: 'nightmare-mangle',
    name: 'Nightmare Mangle',
    game: 4,
    type: 'halloween',
    aliases: ['halloween mangle', 'nightmare toy foxy'],
    tagline: 'A tangle of wire and teeth in the closet.',
    description:
      'The Halloween Edition’s nightmare take on Mangle: a mass of torn wiring, ' +
      'exposed endoskeleton and two sets of jaws. It replaces Nightmare Foxy in the ' +
      'bedroom closet and follows the same staged approach, though unlike Foxy it never ' +
      'reverts to a plush and simply has to be shut out.',
    firstAppearance: "Five Nights at Freddy's 4: Halloween Edition (2015)",
    trivia: [
      'It takes Nightmare Foxy’s place in the closet.',
      'Its second head hangs loose from the main body.',
      'It has no plush form, unlike the character it replaces.',
    ],
  },
  {
    id: 'fredbear-plush',
    name: 'Fredbear Plush',
    game: 4,
    type: 'nightmare',
    aliases: ['plush fredbear', 'yellow plush', 'the plush'],
    tagline: '"Tomorrow is another day."',
    description:
      'A small yellow bear plush with a purple hat and bow tie that appears throughout ' +
      'the fourth game, sitting on the bed and in the minigames between nights. It is the ' +
      'only character that speaks to the crying child, offering warnings and reassurance ' +
      'in text form, and it is the closest thing the game has to a narrator.',
    firstAppearance: "Five Nights at Freddy's 4 (2015)",
    trivia: [
      'Its eyes occasionally turn solid black during the minigames.',
      'It delivers the game’s only direct dialogue to the player character.',
      'It appears in the bedroom whether or not the nightmares do.',
    ],
  },
];

/** Characters belonging to a given game, in database order. */
export function charactersForGame(gameId) {
  return CHARACTERS.filter((c) => c.game === gameId);
}

/** Case-insensitive match against name and aliases. */
export function matchesQuery(character, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (character.name.toLowerCase().includes(q)) return true;
  return character.aliases.some((a) => a.includes(q));
}
