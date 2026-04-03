export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-[#F5E6CA]">
      {/* Header */}
      <div className="bg-[#703418] text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">Our Services</h1>
          <p className="text-[#F5E6CA]">Comprehensive pet care solutions</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Veterinary Care */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-5xl mb-4">🏥</div>
            <h2 className="text-2xl font-bold text-[#703418] mb-3">Veterinary Care</h2>
            <p className="text-gray-600 mb-4">
              Professional veterinary services with experienced doctors available 24/7 for your pet's health needs.
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>✓ Emergency Care</li>
              <li>✓ Regular Check-ups</li>
              <li>✓ Vaccinations</li>
              <li>✓ Surgery</li>
            </ul>
          </div>

          {/* Pet Grooming */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-5xl mb-4">✂️</div>
            <h2 className="text-2xl font-bold text-[#703418] mb-3">Pet Grooming</h2>
            <p className="text-gray-600 mb-4">
              Professional grooming services to keep your pet looking and feeling their best.
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>✓ Bathing & Styling</li>
              <li>✓ Nail Trimming</li>
              <li>✓ Ear Cleaning</li>
              <li>✓ Teeth Cleaning</li>
            </ul>
          </div>

          {/* Pet Boarding */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-5xl mb-4">🏠</div>
            <h2 className="text-2xl font-bold text-[#703418] mb-3">Pet Boarding</h2>
            <p className="text-gray-600 mb-4">
              Safe and comfortable boarding facilities for your pet when you're away.
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>✓ Climate Controlled</li>
              <li>✓ 24/7 Supervision</li>
              <li>✓ Play Areas</li>
              <li>✓ Special Diets</li>
            </ul>
          </div>

          {/* Pet Shop */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-5xl mb-4">🛒</div>
            <h2 className="text-2xl font-bold text-[#703418] mb-3">Pet Shop</h2>
            <p className="text-gray-600 mb-4">
              Quality pet supplies, food, and accessories for all your pet's needs.
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>✓ Premium Pet Food</li>
              <li>✓ Toys & Accessories</li>
              <li>✓ Health Supplements</li>
              <li>✓ Pet Clothing</li>
            </ul>
          </div>

          {/* Training */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-5xl mb-4">🎓</div>
            <h2 className="text-2xl font-bold text-[#703418] mb-3">Pet Training</h2>
            <p className="text-gray-600 mb-4">
              Professional training programs to help your pet become well-behaved and obedient.
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>✓ Basic Obedience</li>
              <li>✓ Behavior Correction</li>
              <li>✓ Socialization</li>
              <li>✓ Advanced Training</li>
            </ul>
          </div>

          {/* Delivery */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-5xl mb-4">🚚</div>
            <h2 className="text-2xl font-bold text-[#703418] mb-3">Home Delivery</h2>
            <p className="text-gray-600 mb-4">
              Fast and reliable delivery of pet supplies right to your doorstep.
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>✓ Same Day Delivery</li>
              <li>✓ Scheduled Delivery</li>
              <li>✓ Subscription Plans</li>
              <li>✓ Free Shipping</li>
            </ul>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 bg-[#703418] text-white rounded-2xl shadow-lg p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Need Help Right Now?</h2>
          <p className="text-xl text-[#F5E6CA] mb-8">
            Request immediate assistance for your pet
          </p>
          <a
            href="/my-pets"
            className="inline-block px-8 py-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors text-lg"
          >
            🚨 Request Assistance
          </a>
        </div>
      </div>
    </div>
  );
}
