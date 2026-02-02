
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
    console.log('Verifying weight_fiscal column...');

    // Attempt to select the new column from a single row
    const { data, error } = await supabase
        .from('inbound_deliveries')
        .select('weight_fiscal')
        .limit(1);

    if (error) {
        if (error.message.includes('does not exist')) {
            console.error('❌ Migration NOT applied: Column weight_fiscal does not exist.');
            console.error('Error details:', error.message);
        } else {
            console.error('❌ Error querying database:', error.message);
        }
        process.exit(1);
    } else {
        console.log('✅ Migration applied successfully: weight_fiscal column exists.');
    }
}

verifyMigration();
