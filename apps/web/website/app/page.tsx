'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import {
  ArrowRight,
  Droplets,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  Search,
  Scissors,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
} from 'lucide-react';
import { PawSewaLogo } from '@/components/PawSewaLogo';
import axios from 'axios';

type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
};

function formatDate(date: string) {
  const [y, m, d] = date.split('-').map((x) => Number(x));
  if (!y || !m || !d) return date;
  return `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
}

interface Vet {
  _id: string;
  name: string;
  specialization?: string;
  clinicName?: string;
  clinicLocation?: string;
  email: string;
}

export default function HomePage() {
  const { user } = useAuth();
  const [searchType, setSearchType] = useState<'vet' | 'shop'>('vet');
  const [searchQuery, setSearchQuery] = useState('');
  const [topVets, setTopVets] = useState<Vet[]>([]);
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 });
  const [blogPosts, setBlogPosts] = useState<BlogPostMeta[]>([]);

  useEffect(() => {
    fetchTopVets();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/blog', { cache: 'force-cache' });
        const json = await res.json();
        if (json?.success && Array.isArray(json.data)) {
          setBlogPosts(json.data.slice(0, 3));
        }
      } catch {
        // ignore; blog teaser is optional on homepage
      }
    })();
  }, []);

  const fetchTopVets = async () => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await axios.get(`${apiBase}/vets/public`);
      if (response.data.success) {
        setTopVets(response.data.data.slice(0, 4));
      }
    } catch (error) {
      console.error('Error fetching vets:', error);
    }
  };

  const handleSearch = () => {
    if (searchType === 'vet') {
      window.location.href = `/vets?search=${encodeURIComponent(searchQuery)}`;
    } else if (searchType === 'shop') {
      window.location.href = `/shop`;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative py-28 md:py-32 px-4 overflow-hidden"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) / (rect.width / 2);
          const dy = (e.clientY - cy) / (rect.height / 2);
          setHeroTilt({
            x: Number((dx * 8).toFixed(2)),
            y: Number((dy * 8).toFixed(2)),
          });
        }}
        onMouseLeave={() => setHeroTilt({ x: 0, y: 0 })}
      >
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-0 left-0 w-full h-full object-cover"
        >
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>
        
        {/* Overlay */}
        <div className="absolute top-0 left-0 w-full h-full bg-primary/70" />

        {/* Playful animated blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-24 -left-24"
            style={{
              transform: `translate3d(${heroTilt.x * 1.2}px, ${heroTilt.y * 1.1}px, 0)`,
            }}
          >
            <div className="h-72 w-72 rounded-full bg-secondary/35 blur-3xl paw-drift" />
          </div>
          <div
            className="absolute top-12 -right-20"
            style={{
              transform: `translate3d(${-heroTilt.x * 1.0}px, ${heroTilt.y * 0.8}px, 0)`,
            }}
          >
            <div className="h-80 w-80 rounded-full bg-white/20 blur-3xl paw-drift" />
          </div>
          <div
            className="absolute -bottom-28 left-1/3"
            style={{
              transform: `translate3d(${heroTilt.x * 0.7}px, ${-heroTilt.y * 1.1}px, 0)`,
            }}
          >
            <div className="h-80 w-80 rounded-full bg-accent/25 blur-3xl paw-drift" />
          </div>
        </div>

        {/* Floating icons */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute left-6 top-24 md:left-14 md:top-28"
            style={{
              transform: `translate3d(${heroTilt.x * 0.9}px, ${heroTilt.y * 0.7}px, 0)`,
            }}
          >
            <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-2 paw-float">
              <PawSewaLogo variant="nav" height={28} className="brightness-0 invert max-w-[120px]" />
            </div>
          </div>
          <div
            className="absolute right-6 top-32 md:right-16 md:top-36"
            style={{
              transform: `translate3d(${-heroTilt.x * 0.8}px, ${heroTilt.y * 0.9}px, 0)`,
            }}
          >
            <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-3 paw-float-slow">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <div
            className="absolute left-10 bottom-20 md:left-24 md:bottom-24"
            style={{
              transform: `translate3d(${heroTilt.x * 0.7}px, ${-heroTilt.y * 0.8}px, 0)`,
            }}
          >
            <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-3 paw-float-slow">
              <Heart className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="container mx-auto text-center relative z-10">
          <ScrollReveal className="space-y-8">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-2 font-poppins leading-tight">
              Care Your Pets Deserve,<br />Convenience You Love
            </h1>
            <p className="text-xl md:text-2xl text-secondary mb-8 max-w-3xl mx-auto font-inter text-balance">
              Connect with trusted veterinarians, hostels, grooming and more — all in one place.
            </p>

            {/* Primary CTAs (more interactive) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/services/request" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto px-8 py-4 text-base sm:text-lg rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-[1px]"
                >
                  <span className="inline-flex items-center gap-2">
                    Request Help Now <ArrowRight className="h-5 w-5" />
                  </span>
                </Button>
              </Link>
              <Link href="/vets" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto px-8 py-4 text-base sm:text-lg rounded-2xl border border-white/30 bg-white/10 text-white hover:bg-white/15"
                >
                  <span className="inline-flex items-center gap-2">
                    Explore Vets <Stethoscope className="h-5 w-5" />
                  </span>
                </Button>
              </Link>
            </div>
          </ScrollReveal>

          {/* Unified Search Bar */}
          <ScrollReveal delay={150} className="max-w-4xl mx-auto bg-white/95 rounded-2xl shadow-2xl p-6 backdrop-blur">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Type Toggle */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                <Button
                  type="button"
                  variant={searchType === 'vet' ? 'primary' : 'secondary'}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg"
                  onClick={() => setSearchType('vet')}
                >
                  <Stethoscope className="w-5 h-5" />
                  <span>Veterinarians</span>
                </Button>
                <Button
                  type="button"
                  variant={searchType === 'shop' ? 'primary' : 'secondary'}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg"
                  onClick={() => setSearchType('shop')}
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>Pet Shops</span>
                </Button>
              </div>

              {/* Search Input */}
              <div className="flex-1 flex gap-2">
                <div className="flex-1 relative">
                  <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder={`Search by location or name...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none text-gray-700 transition-all focus:shadow-[0_0_0_6px_rgba(255,255,255,0.4)]"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSearch}
                  className="px-8 py-4 flex items-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  <span>Search</span>
                </Button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Service grid: Hostel, Grooming, Spa, Wash, Training */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          <ScrollReveal className="space-y-4">
            <h2 className="text-4xl font-bold text-center text-primary mb-1 font-poppins">
              Pet Care Services
            </h2>
            <p className="text-center text-gray-600 mb-6 font-inter text-balance">
              Book hostels, grooming, spa, wash & training in one place.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={120}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 md:gap-6 max-w-4xl mx-auto">
              <Link href="/care/hostel" className="paw-card-glass flex flex-col items-center p-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <Home className="w-7 h-7 md:w-8 md:h-8 text-primary" />
                </div>
                <span className="font-semibold text-primary text-center">Hostel</span>
              </Link>
              <Link href="/care/grooming" className="paw-card-glass flex flex-col items-center p-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <Scissors className="w-7 h-7 md:w-8 md:h-8 text-primary" />
                </div>
                <span className="font-semibold text-primary text-center">Grooming</span>
              </Link>
              <Link href="/care/spa" className="paw-card-glass flex flex-col items-center p-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <Sparkles className="w-7 h-7 md:w-8 md:h-8 text-primary" />
                </div>
                <span className="font-semibold text-primary text-center">Spa</span>
              </Link>
              <Link href="/care/wash" className="paw-card-glass flex flex-col items-center p-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <Droplets className="w-7 h-7 md:w-8 md:h-8 text-primary" />
                </div>
                <span className="font-semibold text-primary text-center">Wash</span>
              </Link>
              <Link href="/care/training" className="paw-card-glass flex flex-col items-center p-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <GraduationCap className="w-7 h-7 md:w-8 md:h-8 text-primary" />
                </div>
                <span className="font-semibold text-primary text-center">Training</span>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Medical & Shop */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="container mx-auto">
          <ScrollReveal className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="text-center p-8 rounded-2xl bg-white shadow-md hover:shadow-xl transition-all">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Stethoscope className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary mb-2 font-poppins">Medical Care</h3>
              <p className="text-gray-600 mb-4 font-inter text-sm">Vets, checkups & vaccinations</p>
              <Link href="/vets" className="inline-flex">
                <Button variant="ghost" className="text-primary font-semibold flex items-center gap-2 mx-auto hover:gap-3 transition-all">
                  Find Vets <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="text-center p-8 rounded-2xl bg-white shadow-md hover:shadow-xl transition-all">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary mb-2 font-poppins">Pet Supplies</h3>
              <p className="text-gray-600 mb-4 font-inter text-sm">Food, toys & accessories</p>
              <Link href="/shop" className="inline-flex">
                <Button variant="ghost" className="text-primary font-semibold flex items-center gap-2 mx-auto hover:gap-3 transition-all">
                  Browse Shop <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Top Rated Vets */}
      <section className="py-20 px-4 bg-gradient-to-br from-secondary to-white">
        <div className="container mx-auto">
          <ScrollReveal className="space-y-4">
            <h2 className="text-4xl font-bold text-center text-primary mb-1 font-poppins">
              Top Rated Vets Near You
            </h2>
            <p className="text-center text-gray-600 mb-6 font-inter">
              Trusted professionals ready to care for your pets.
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={120}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {topVets.map((vet) => (
                <Link key={vet._id} href={`/vets/${vet._id}`}>
                  <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all transform hover:-translate-y-2 cursor-pointer">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl font-bold text-white">
                        {vet.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 text-center mb-2 font-poppins">
                      Dr. {vet.name}
                    </h3>
                    <p className="text-primary text-center text-sm font-medium mb-2">
                      {vet.specialization || 'General Practitioner'}
                    </p>
                    <p className="text-gray-600 text-center text-sm mb-3 font-inter">
                      {vet.clinicName || 'Private Practice'}
                    </p>
                    <div className="flex items-center justify-center gap-1 text-yellow-500">
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </ScrollReveal>

          <div className="text-center mt-12">
            <Link href="/vets">
              <Button variant="primary" className="px-8 py-4 text-lg">
                View All Veterinarians
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="py-20 px-4 bg-gradient-to-r from-primary to-accent text-white">
          <div className="container mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6 font-poppins">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-secondary mb-8 max-w-2xl mx-auto font-inter">
              Join thousands of pet owners and veterinarians using PawSewa
            </p>
            <Link href="/register">
              <Button variant="secondary" className="text-lg px-8 py-4">
                Create Free Account
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Blog teaser (SEO) */}
      <section className="py-16 px-4 bg-white">
        <div className="container mx-auto">
          <ScrollReveal className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-primary font-poppins">
                PawSewa Blog
              </h2>
              <p className="text-gray-600 font-inter mt-2 max-w-2xl">
                Practical pet-care tips, guides, and platform updates.
              </p>
            </div>
            <Link href="/blog">
              <Button variant="ghost" className="font-semibold">
                View all posts <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </ScrollReveal>

          <ScrollReveal delay={120}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              {blogPosts.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group paw-card-glass p-6"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-primary bg-white/70 px-3 py-1 rounded-full">
                        {formatDate(p.date)}
                      </span>
                      <span className="text-xs text-gray-600 font-inter">
                        {p.tags.slice(0, 2).join(' · ')}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-gray-900 font-poppins group-hover:text-primary transition-colors">
                      {p.title}
                    </h3>
                    {p.description ? (
                      <p className="text-gray-600 font-inter mt-2 line-clamp-3">
                        {p.description}
                      </p>
                    ) : null}
                    <div className="mt-4 text-primary font-semibold">
                      Read more →
                    </div>
                  </Link>
                ))}
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
