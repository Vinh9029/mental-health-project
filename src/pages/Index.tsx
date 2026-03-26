import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Shield, Heart, Users, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

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

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

export default function Index() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg hero-gradient flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-heading text-xl font-semibold text-foreground">MindCare AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/chat">Chat</Link>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <Link to="/screening">Start Screening</Link>
            </Button>
            {user ? (
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign Out
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight"
          >
            Your Journey to Mental Wellness Starts{" "}
            <span className="inline-block text-primary">Here</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Connect with our compassionate AI assistant for personalized mental health support.
            Available 24/7 to listen, understand, and guide you toward better mental wellness.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <Button variant="hero" size="xl" asChild>
              <Link to="/screening">Start Screening</Link>
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <a href="#features">Learn More</a>
            </Button>
          </motion.div>
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
