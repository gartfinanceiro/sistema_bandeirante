
import { createClient } from "@supabase/supabase-js";

// import 'dotenv/config'; // Not needed if sourced manually

// Try to get env vars from process or a local .env.local file if possible
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function check() {
    console.log("Checking database...");

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error("Missing credentials. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.");
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Check Cost Centers
    const { count: ccCount, error: ccError } = await supabase
        .from('cost_centers')
        .select('*', { count: 'exact', head: true });

    if (ccError) console.error("Cost Centers Error:", ccError);
    console.log(`Cost Centers Count: ${ccCount}`);

    // 2. Check Categories
    const { count: catCount, data: cats, error: catError } = await supabase
        .from('transaction_categories')
        .select('id, name, slug, cost_center_id');

    if (catError) console.error("Categories Error:", catError);
    console.log(`Categories Count: ${cats?.length}`);

    if (cats && cats.length > 0) {
        console.log("Sample Categories:", cats.slice(0, 5));
        const withSlug = cats.filter(c => c.slug);
        console.log(`Categories with Slug: ${withSlug.length}`);
    }
}

check();
