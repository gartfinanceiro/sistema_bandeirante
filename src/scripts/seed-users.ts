
import { createClient } from "@supabase/supabase-js";
// import 'dotenv/config'; // Assumes env vars are loaded externally

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing credentials. Please check .env");
    process.exit(1);
}

// NOTE: Using the service role key is preferred for admin actions, 
// but normal signUp works with Anon key if "Confirm Email" is disabled in Supabase.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const USERS = [
    { email: "thiago@bandeirante.com", password: "bandeirante", name: "Thiago" },
    { email: "rodrigo@bandeirante.com", password: "bandeirante", name: "Rodrigo" },
    { email: "marquinho@bandeirante.com", password: "bandeirante", name: "Marquinho" },
    { email: "gustavo@bandeirante.com", password: "bandeirante", name: "Gustavo" },
];

async function seedUsers() {
    console.log("Seeding users...");

    for (const user of USERS) {
        console.log(`Creating ${user.name} (${user.email})...`);

        // Attempt Sign Up
        const { data, error } = await supabase.auth.signUp({
            email: user.email,
            password: user.password,
            options: {
                data: {
                    full_name: user.name,
                },
            },
        });

        if (error) {
            console.error(`Error creating ${user.name}:`, error.message);
        } else if (data.user) {
            console.log(`Success: ${user.name} created (ID: ${data.user.id})`);
            // Logs logic to confirm if created or already exists
            if (data.user.identities && data.user.identities.length === 0) {
                console.log(`User ${user.email} likely already exists.`);
            }
        }
    }
}

seedUsers();
