
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listMaterials() {
    // Sign in first
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: "thiago@bandeirante.com",
        password: "bandeirante",
    });

    if (authError || !authData.session) {
        console.error("Auth Failed:", authError?.message);
        return;
    }

    console.log("Authenticated as:", authData.user.email);

    const { data: materials, error } = await supabase.from("materials").select("id, name");
    if (error) {
        console.error(error);
    } else {
        console.log("Materials:", materials);
    }
}

listMaterials();
