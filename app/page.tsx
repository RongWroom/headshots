import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import HeroSection from "@/components/homepage/HeroSection"
import BrandsSection from "@/components/homepage/BrandsSection"
import ProcessSection from "@/components/homepage/ProcessSection"
import FeaturesSection from "@/components/homepage/FeaturesSection"
import ExamplesSection from "@/components/homepage/ExamplesSection"
import TestimonialsSection from "@/components/homepage/TestimonialsSection"
import PricingSection from "@/components/homepage/PricingSection"
import FAQSection from "@/components/homepage/FAQSection"
import CTASection from "@/components/homepage/CTASection"

export const dynamic = "force-dynamic"

export default async function Index() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          const store = await cookieStore;
          return store.get(name)?.value;
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return redirect("/overview")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
        <HeroSection />
        <BrandsSection />
        <ProcessSection />
        <FeaturesSection />
        <ExamplesSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </div>
    </div>
  )
}
