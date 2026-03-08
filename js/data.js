// Fake DB and Initial State definition
const DB_KEY = 'caption_ai_db';

const defaultDB = {
    users: [
        {
            id: 'demo-user',
            name: 'Demo User',
            email: 'demo@example.com',
            password: 'password123',
            plan: 'Pro', // Can be 'Free' or 'Pro'
            credits: 999,
            history: [],
            schedule: [],
            reviews: []
        }
    ],
    reviews: [
        { id: '1', userName: 'Sarah J.', rating: 5, text: 'This tool saved me 10 hours a week! The captions are insanely good and sound exactly like me.', avatar: 'S' },
        { id: '2', userName: 'Mike T.', rating: 5, text: 'The Aesthetic tone perfectly matches my brand. Best tool ever.', avatar: 'M' },
        { id: '3', userName: 'Evelyn W.', rating: 4, text: 'Love the hashtag generator. Increased my reach by 40%.', avatar: 'E' }
    ]
};

// Initialize DB if not present
if (!localStorage.getItem(DB_KEY)) {
    localStorage.setItem(DB_KEY, JSON.stringify(defaultDB));
}

function getDB() {
    return JSON.parse(localStorage.getItem(DB_KEY));
}

function saveDB(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
}
