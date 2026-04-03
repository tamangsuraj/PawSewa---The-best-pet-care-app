export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F5E6CA]">
      {/* Header */}
      <div className="bg-[#703418] text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">About PawSewa</h1>
          <p className="text-[#F5E6CA]">Your trusted partner in pet care</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Mission Section */}
        <div className="bg-white rounded-2xl shadow-lg p-12 mb-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-6xl mb-6">🐾</div>
            <h2 className="text-3xl font-bold text-[#703418] mb-6">Our Mission</h2>
            <p className="text-xl text-gray-700 leading-relaxed mb-6">
              At PawSewa, we're dedicated to providing exceptional veterinary care and pet services 
              through our innovative centralized dispatcher model. We connect pet owners with the 
              best available veterinarians, ensuring your furry friends receive immediate, 
              professional care when they need it most.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed">
              Our mission is to make quality pet healthcare accessible, efficient, and stress-free 
              for every pet owner in Nepal.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-[#703418] text-center mb-8">How PawSewa Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-[#703418] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold text-[#703418] mb-3">Request Assistance</h3>
              <p className="text-gray-600">
                Submit your pet's issue through our mobile app or website. No need to choose a vet - 
                we handle that for you.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-[#703418] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold text-[#703418] mb-3">We Assign a Vet</h3>
              <p className="text-gray-600">
                Our admin team reviews your case and assigns the best available veterinarian based 
                on their expertise and current shift.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-[#703418] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold text-[#703418] mb-3">Get Expert Care</h3>
              <p className="text-gray-600">
                The assigned veterinarian contacts you and provides professional care for your pet. 
                Track the status in real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="bg-gradient-to-br from-[#703418] to-[#8B4513] text-white rounded-2xl shadow-lg p-12 mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">Why Choose PawSewa?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="text-3xl">⚡</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Fast Response</h3>
                <p className="text-[#F5E6CA]">
                  Our centralized system ensures quick assignment and immediate veterinary attention.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">👨‍⚕️</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Expert Veterinarians</h3>
                <p className="text-[#F5E6CA]">
                  All our vets are licensed professionals with years of experience in pet care.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🕐</div>
              <div>
                <h3 className="text-xl font-bold mb-2">24/7 Availability</h3>
                <p className="text-[#F5E6CA]">
                  Our shift-based system ensures veterinary care is available round the clock.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">📱</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Easy to Use</h3>
                <p className="text-[#F5E6CA]">
                  Simple mobile apps and website interface make requesting help effortless.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🎯</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Smart Matching</h3>
                <p className="text-[#F5E6CA]">
                  We match your pet's needs with the most suitable veterinarian available.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">💚</div>
              <div>
                <h3 className="text-xl font-bold mb-2">Compassionate Care</h3>
                <p className="text-[#F5E6CA]">
                  We treat every pet with love and care, as if they were our own.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Our Team */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-[#703418] text-center mb-8">Our Team</h2>
          <div className="bg-white rounded-2xl shadow-lg p-12">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                PawSewa is powered by a dedicated team of veterinary professionals, dispatchers, 
                and pet care specialists who work together to ensure your pet receives the best 
                possible care.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                Our veterinarians specialize in various fields including surgery, dentistry, 
                emergency care, and general practice. Each member of our team shares a common 
                passion: the health and happiness of your pets.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-[#703418] text-white rounded-2xl shadow-lg p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Experience Better Pet Care?</h2>
          <p className="text-xl text-[#F5E6CA] mb-8">
            Join thousands of pet owners who trust PawSewa for their pet's health
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/register"
              className="inline-block px-8 py-4 bg-white text-[#703418] rounded-lg font-semibold hover:bg-gray-100 transition-colors text-lg"
            >
              Get Started
            </a>
            <a
              href="/vets"
              className="inline-block px-8 py-4 bg-[#8B4513] text-white rounded-lg font-semibold hover:bg-[#A0522D] transition-colors text-lg"
            >
              Browse Veterinarians
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
