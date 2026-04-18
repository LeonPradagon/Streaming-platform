const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdmin() {
  const email = "admin@antigravity.com";
  const password = "AdminAntigravity123!";
  const fullName = "Antigravity Admin";

  console.log(`Mencoba membuat akun: ${email}...`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      console.log("Akun sudah terdaftar. Anda bisa langsung login.");
    } else {
      console.error("Error membuat akun:", error.message);
    }
    return;
  }

  console.log("Akun berhasil dibuat!");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("Silakan login di halaman /login");
}

createAdmin();
