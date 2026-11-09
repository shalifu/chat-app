import { useState } from "react";

const emojiCategories = [
  {
    name: "Smileys",
    emojis: [
      ["😀", "Grinning face"], ["😃", "Grinning face with big eyes"], ["😄", "Grinning face with smiling eyes"],
      ["😁", "Beaming face"], ["😆", "Grinning squinting face"], ["😅", "Grinning face with sweat"],
      ["🤣", "Rolling on the floor laughing"], ["😂", "Face with tears of joy"], ["🙂", "Slightly smiling face"],
      ["🙃", "Upside-down face"], ["😉", "Winking face"], ["😊", "Smiling face with smiling eyes"],
      ["😇", "Smiling face with halo"], ["🥰", "Smiling face with hearts"], ["😍", "Heart eyes"],
      ["🤩", "Star-struck"], ["😘", "Face blowing a kiss"], ["😋", "Face savoring food"],
      ["😛", "Face with tongue"], ["😜", "Winking face with tongue"], ["🤪", "Zany face"],
      ["😎", "Smiling face with sunglasses"], ["🥳", "Partying face"], ["😭", "Loudly crying face"],
      ["😢", "Crying face"], ["😡", "Pouting face"], ["😮", "Face with open mouth"],
      ["🤔", "Thinking face"], ["🤗", "Hugging face"], ["🥱", "Yawning face"],
    ],
  },
  {
    name: "People",
    emojis: [
      ["👋", "Waving hand"], ["🤚", "Raised back of hand"], ["✋", "Raised hand"], ["🖖", "Vulcan salute"],
      ["👌", "OK hand"], ["🤌", "Pinched fingers"], ["🤏", "Pinching hand"], ["✌️", "Victory hand"],
      ["🤞", "Crossed fingers"], ["🫰", "Finger heart"], ["🤟", "Love-you gesture"], ["🤘", "Sign of the horns"],
      ["🤙", "Call me hand"], ["👈", "Backhand pointing left"], ["👉", "Backhand pointing right"],
      ["👆", "Backhand pointing up"], ["👇", "Backhand pointing down"], ["☝️", "Index pointing up"],
      ["👍", "Thumbs up"], ["👎", "Thumbs down"], ["✊", "Raised fist"], ["👊", "Oncoming fist"],
      ["👏", "Clapping hands"], ["🙌", "Raising hands"], ["🫶", "Heart hands"], ["🤝", "Handshake"],
      ["🙏", "Folded hands"], ["💪", "Flexed biceps"], ["🧑‍💻", "Technologist"], ["🕺", "Man dancing"],
    ],
  },
  {
    name: "Animals",
    emojis: [
      ["🐶", "Dog face"], ["🐱", "Cat face"], ["🐭", "Mouse face"], ["🐹", "Hamster"],
      ["🐰", "Rabbit face"], ["🦊", "Fox"], ["🐻", "Bear"], ["🐼", "Panda"],
      ["🐨", "Koala"], ["🐯", "Tiger face"], ["🦁", "Lion"], ["🐮", "Cow face"],
      ["🐷", "Pig face"], ["🐸", "Frog"], ["🐵", "Monkey face"], ["🙈", "See-no-evil monkey"],
      ["🐔", "Chicken"], ["🐧", "Penguin"], ["🐦", "Bird"], ["🦆", "Duck"],
      ["🦅", "Eagle"], ["🦉", "Owl"], ["🦋", "Butterfly"], ["🐌", "Snail"],
      ["🐢", "Turtle"], ["🐍", "Snake"], ["🐬", "Dolphin"], ["🐳", "Whale"],
      ["🦄", "Unicorn"], ["🐝", "Honeybee"],
    ],
  },
  {
    name: "Food",
    emojis: [
      ["🍏", "Green apple"], ["🍎", "Red apple"], ["🍐", "Pear"], ["🍊", "Tangerine"],
      ["🍋", "Lemon"], ["🍌", "Banana"], ["🍉", "Watermelon"], ["🍇", "Grapes"],
      ["🍓", "Strawberry"], ["🫐", "Blueberries"], ["🍒", "Cherries"], ["🍍", "Pineapple"],
      ["🥑", "Avocado"], ["🍅", "Tomato"], ["🥕", "Carrot"], ["🌽", "Ear of corn"],
      ["🍞", "Bread"], ["🧀", "Cheese wedge"], ["🥚", "Egg"], ["🍳", "Cooking"],
      ["🥞", "Pancakes"], ["🍔", "Hamburger"], ["🍟", "French fries"], ["🍕", "Pizza"],
      ["🌮", "Taco"], ["🍜", "Steaming bowl"], ["🍣", "Sushi"], ["🍰", "Shortcake"],
      ["🍪", "Cookie"], ["☕", "Hot beverage"],
    ],
  },
  {
    name: "Travel",
    emojis: [
      ["🚗", "Car"], ["🚕", "Taxi"], ["🚌", "Bus"], ["🚎", "Trolleybus"],
      ["🏎️", "Racing car"], ["🚓", "Police car"], ["🚑", "Ambulance"], ["🚒", "Fire engine"],
      ["🚲", "Bicycle"], ["🛵", "Motor scooter"], ["🚂", "Locomotive"], ["✈️", "Airplane"],
      ["🚀", "Rocket"], ["🛸", "Flying saucer"], ["🚁", "Helicopter"], ["⛵", "Sailboat"],
      ["🚢", "Ship"], ["🏠", "House"], ["🏡", "House with garden"], ["🏢", "Office building"],
      ["🏰", "Castle"], ["⛪", "Church"], ["🌋", "Volcano"], ["🏖️", "Beach with umbrella"],
      ["🏕️", "Camping"], ["🌅", "Sunrise"], ["🌈", "Rainbow"], ["🌍", "Globe showing Europe and Africa"],
      ["🌙", "Crescent moon"], ["⭐", "Star"],
    ],
  },
  {
    name: "Activities",
    emojis: [
      ["⚽", "Soccer ball"], ["🏀", "Basketball"], ["🏈", "American football"], ["⚾", "Baseball"],
      ["🎾", "Tennis"], ["🏐", "Volleyball"], ["🏉", "Rugby football"], ["🎱", "Pool 8 ball"],
      ["🏓", "Ping pong"], ["🏸", "Badminton"], ["🥊", "Boxing glove"], ["⛳", "Flag in hole"],
      ["🎯", "Bullseye"], ["🎮", "Video game"], ["🕹️", "Joystick"], ["🎲", "Game die"],
      ["🎭", "Performing arts"], ["🎨", "Artist palette"], ["🎤", "Microphone"], ["🎧", "Headphone"],
      ["🎼", "Musical score"], ["🎹", "Musical keyboard"], ["🥁", "Drum"], ["🎸", "Guitar"],
      ["🎻", "Violin"], ["🎬", "Clapper board"], ["🎟️", "Admission tickets"], ["🎉", "Party popper"],
      ["🎊", "Confetti ball"], ["🏆", "Trophy"],
    ],
  },
  {
    name: "Objects",
    emojis: [
      ["⌚", "Watch"], ["📱", "Mobile phone"], ["💻", "Laptop"], ["⌨️", "Keyboard"],
      ["🖥️", "Desktop computer"], ["🖨️", "Printer"], ["📷", "Camera"], ["📹", "Video camera"],
      ["💡", "Light bulb"], ["🔦", "Flashlight"], ["📚", "Books"], ["📖", "Open book"],
      ["✏️", "Pencil"], ["🖊️", "Pen"], ["📝", "Memo"], ["📌", "Pushpin"],
      ["🔒", "Locked"], ["🔑", "Key"], ["🔨", "Hammer"], ["🧰", "Toolbox"],
      ["🎁", "Wrapped gift"], ["🎈", "Balloon"], ["🪄", "Magic wand"], ["🧸", "Teddy bear"],
      ["🕯️", "Candle"], ["🪴", "Potted plant"], ["💎", "Gem stone"], ["👑", "Crown"],
      ["💰", "Money bag"], ["📦", "Package"],
    ],
  },
  {
    name: "Symbols",
    emojis: [
      ["❤️", "Red heart"], ["🧡", "Orange heart"], ["💛", "Yellow heart"], ["💚", "Green heart"],
      ["💙", "Blue heart"], ["💜", "Purple heart"], ["🖤", "Black heart"], ["🤍", "White heart"],
      ["💔", "Broken heart"], ["💕", "Two hearts"], ["💞", "Revolving hearts"], ["💖", "Sparkling heart"],
      ["💘", "Heart with arrow"], ["💝", "Heart with ribbon"], ["💟", "Heart decoration"], ["❣️", "Heart exclamation"],
      ["🔥", "Fire"], ["✨", "Sparkles"], ["💫", "Dizzy"], ["🌟", "Glowing star"],
      ["💯", "Hundred points"], ["✅", "Check mark button"], ["❌", "Cross mark"], ["⚠️", "Warning"],
      ["💤", "Zzz"], ["♻️", "Recycling symbol"], ["🔔", "Bell"], ["💬", "Speech balloon"],
      ["📢", "Loudspeaker"], ["🔝", "Top arrow"],
    ],
  },
];

export default function EmojiPalette({ onSelect }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const category = emojiCategories[activeCategory];

  return (
    <span className="emoji-picker" role="dialog" aria-label="Choose an emoji">
      <span className="emoji-categories" role="tablist" aria-label="Emoji categories">
        {emojiCategories.map((item, index) => <button
          key={item.name}
          type="button"
          role="tab"
          aria-selected={activeCategory === index}
          className={`emoji-category ${activeCategory === index ? "active" : ""}`}
          onClick={() => setActiveCategory(index)}
        >{item.name}</button>)}
      </span>
      <span className="emoji-category-title">{category.name}</span>
      <span className="emoji-options">
        {category.emojis.map(([emoji, name]) => <button
          key={emoji}
          type="button"
          className="emoji-option"
          aria-label={name}
          title={name}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(emoji)}
        >{emoji}</button>)}
      </span>
    </span>
  );
}
