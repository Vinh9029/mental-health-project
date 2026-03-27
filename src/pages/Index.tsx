import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, MessageCircle, Shield, Heart, Users, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

import mentalHealth1 from "@/assets/mental-health-1.jpg";
import mentalHealth2 from "@/assets/mental-health-2.jpg";
import mentalHealth3 from "@/assets/mental-health-3.jpg";
import mentalHealth4 from "@/assets/mental-health-4.jpg";
import mentalHealth5 from "@/assets/mental-health-5.jpg";

const stats = [
  { icon: Users, value: "10k+", label: "Active Users" },
  { icon: Star, value: "95%", label: "Satisfaction" },
  { icon: Clock, value: "24/7", label: "Available" },
];

const features = [
  {
    icon: Brain,
    title: "ML-Powered Diagnosis",
    description: "Advanced algorithms analyze your responses to provide accurate mental health insights.",
  },
  {
    icon: MessageCircle,
    title: "24/7 Virtual Assistant",
    description: "An AI companion ready to listen, support, and guide you at any time of day.",
  },
  {
    icon: Heart,
    title: "Personalized Care",
    description: "Tailored coping strategies and resources based on your unique mental health profile.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your data is encrypted end-to-end. We never share your personal information.",
  },
];

const galleryImages = [
  { src: mentalHealth1, alt: "Mindfulness meditation in nature", caption: "Mindfulness & Meditation" },
  { src: mentalHealth2, alt: "Supportive therapy conversation", caption: "Professional Support" },
  { src: mentalHealth3, alt: "Brain wellness with nature elements", caption: "Brain Wellness" },
  { src: mentalHealth4, alt: "Self-care and journaling", caption: "Self-Care Rituals" },
  { src: mentalHealth5, alt: "Community mental health support", caption: "Community & Connection" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-4 overflow-hidden">
        {/* Decorative blobs */}
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />

        <div className="container mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left column */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight"
            >
              Your Journey to{" "}
              <span className="text-primary">Mental Wellness</span>{" "}
              Starts Here
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed"
            >
              Connect with our compassionate AI assistant for personalized mental health support.
              Available 24/7 to listen, understand, and guide you toward better mental wellness.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <Button variant="hero" size="xl" asChild>
                <Link to="/screening">Start Screening</Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <a href="#features">Learn More</a>
              </Button>
            </motion.div>
          </div>

          {/* Right column — decorative composition */}
          <div className="relative flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="relative z-10 w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96 rounded-[2rem] overflow-hidden card-elevated"
            >
              <img src={mentalHealth1} alt="Mental wellness illustration" className="w-full h-full object-cover" />
            </motion.div>

            {/* Floating icons */}
            {[
              { Icon: Heart, className: "top-2 right-0 bg-destructive/15 text-destructive", y: [0, -10, 0] },
              { Icon: Brain, className: "-left-4 top-1/4 bg-primary/15 text-primary", y: [0, 12, 0] },
              { Icon: MessageCircle, className: "bottom-4 -left-2 bg-accent/15 text-accent", y: [0, -8, 0] },
              { Icon: Shield, className: "-right-2 bottom-1/4 bg-primary/15 text-primary", y: [0, 10, 0] },
            ].map(({ Icon, className, y }, i) => (
              <motion.div
                key={i}
                animate={{ y }}
                transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                className={`absolute z-20 h-12 w-12 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-md ${className}`}
              >
                <Icon className="h-6 w-6" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="pb-16 px-4">
        <div className="container mx-auto">
          <div className="flex flex-wrap justify-center gap-8 lg:gap-16">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="flex items-center gap-3"
              >
                <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-heading text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Widget */}
      <section className="py-16 px-4 overflow-hidden">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-heading font-bold text-center text-foreground mb-10"
          >
            Wellness in Every Moment
          </motion.h2>
          <div className="relative">
            <motion.div
              className="flex gap-5"
              animate={{ x: [0, -1200, 0] }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            >
              {[...galleryImages, ...galleryImages].map((img, i) => (
                <div key={i} className="shrink-0 w-64 group">
                  <div className="relative overflow-hidden rounded-2xl card-elevated">
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading="lazy"
                      width={640}
                      height={512}
                      className="w-full h-44 object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <p className="absolute bottom-3 left-3 right-3 text-sm font-medium text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {img.caption}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-secondary/40">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-heading font-bold text-center text-foreground mb-14"
          >
            How MindCare AI Helps You
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="bg-card rounded-2xl p-7 card-elevated"
              >
                <div className="h-12 w-12 rounded-xl hero-gradient flex items-center justify-center mb-5">
                  <f.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-card-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} MindCare AI. This is a support tool, not a replacement for professional care.</p>
        </div>
      </footer>
    </div>
  );
}
