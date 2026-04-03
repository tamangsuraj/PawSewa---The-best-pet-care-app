'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Eye, X, Store, PackagePlus, Edit, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Breadcrumbs } from '@/components/Breadcrumbs';

interface ShopOwner {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  shopName?: string;
  businessLicense?: string;
  isVerified?: boolean;
  createdAt: string;
}

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  isAvailable: boolean;
  images?: string[];
  category?: {
    _id: string;
    name: string;
    slug: string;
  };
}

interface CategoryOption {
  _id: string;
  name: string;
  slug: string;
}

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  price: z
    .string()
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) > 0, {
      message: 'Price must be a positive number',
    }),
  stockQuantity: z
    .string()
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 0, {
      message: 'Stock quantity must be a non-negative number',
    }),
  category: z.string().min(1, 'Category is required'),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters for better product quality'),
  isAvailable: z.boolean().default(true),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function ShopOwnersPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [shopOwners, setShopOwners] = useState<ShopOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedShop, setSelectedShop] = useState<ShopOwner | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    location: '',
    shopName: '',
    businessLicense: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  // Product management state
  const [products, setProducts] = useState<Product[]>([]);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormLoading, setProductFormLoading] = useState(false);
  const [productError, setProductError] = useState('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryFormLoading, setCategoryFormLoading] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryImage, setCategoryImage] = useState<File | null>(null);
  const [images, setImages] = useState<FileList | null>(null);

  const {
    register: registerProduct,
    handleSubmit: handleProductSubmit,
    reset: resetProductForm,
    setValue: setProductValue,
    formState: { errors: productErrors, isSubmitting: isProductSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      price: '',
      stockQuantity: '',
      category: '',
      isAvailable: true,
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchShopOwners();
      fetchProducts();
      fetchCategories();
    }
  }, [isAuthenticated, router]);

  const fetchShopOwners = async () => {
    try {
      const response = await api.get('/users');
      const allUsers = response.data.data;
      const shops = allUsers.filter((u: any) => u.role === 'shop_owner');
      setShopOwners(shops);
    } catch (error) {
      console.error('Error fetching shop owners:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      await api.post('/users/admin/create', {
        ...formData,
        role: 'shop_owner',
      });

      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        location: '',
        shopName: '',
        businessLicense: '',
      });
      setShowModal(false);
      fetchShopOwners();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create shop owner');
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewDetails = async (shopId: string) => {
    try {
      const response = await api.get(`/users/${shopId}`);
      setSelectedShop(response.data.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching shop details:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shop owner?')) return;

    try {
      await api.delete(`/users/${id}`);
      fetchShopOwners();
    } catch (error) {
      console.error('Error deleting shop owner:', error);
    }
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    resetProductForm({
      name: '',
      description: '',
      price: '',
      stockQuantity: '',
      category: categories[0]?._id || '',
      isAvailable: true,
    });
    setImages(null);
    setProductError('');
    setProductFormOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    resetProductForm({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stockQuantity: product.stockQuantity.toString(),
      category: product.category?._id || '',
      isAvailable: product.isAvailable,
    });
    setImages(null);
    setProductError('');
    setProductFormOpen(true);
  };

  const handleProductImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImages(e.target.files);
  };

  const handleSubmitProduct = async (values: ProductFormValues) => {
    setProductFormLoading(true);
    setProductError('');

    try {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('description', values.description);
      formData.append('price', values.price);
      formData.append('stockQuantity', values.stockQuantity);
      if (values.category) {
        formData.append('category', values.category);
      }
      formData.append('isAvailable', values.isAvailable ? 'true' : 'false');
      if (images && images.length > 0) {
        Array.from(images).forEach((file) => {
          formData.append('images', file);
        });
      }

      // Do not set Content-Type: axios will set multipart/form-data with boundary.
      if (editingProduct) {
        await api.patch(`/products/${editingProduct._id}`, formData);
      } else {
        await api.post('/products', formData);
      }

      setProductFormOpen(false);
      setEditingProduct(null);
      await fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      setProductError(error.response?.data?.message || 'Failed to save product');
    } finally {
      setProductFormLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      await fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const filteredShops = shopOwners.filter(shop =>
    shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shop.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (shop.shopName && shop.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Shop', href: '/shops' },
            { label: 'Products & Owners' },
          ]}
        />
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <Store className="w-8 h-8 text-primary" />
          Shop & Products Management
        </h1>
        <p className="text-gray-600">
          Manage shop owners and the product catalogue visible in the customer app.
        </p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search shop owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <Store className="w-4 h-4" />
            Add Shop Owner
          </button>
          <button
            onClick={openCreateProduct}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <PackagePlus className="w-4 h-4" />
            Add Product
          </button>
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors shadow-sm text-sm"
          >
            + Add Category
          </button>
        </div>
      </div>

      {/* Shop owners table */}
      <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm mb-10">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Shop Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredShops.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No shop owners found
                </td>
              </tr>
            ) : (
              filteredShops.map((shop) => (
                <tr key={shop._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-900">{shop.name}</td>
                  <td className="px-6 py-4 text-gray-700">{shop.shopName || '-'}</td>
                  <td className="px-6 py-4 text-gray-700">{shop.email}</td>
                  <td className="px-6 py-4 text-gray-700">{shop.phone || '-'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                      Verified
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleViewDetails(shop._id)}
                        className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors text-sm flex items-center gap-1 border border-primary/20"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(shop._id)}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-colors text-sm border border-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Products table */}
      <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm mb-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-primary" />
            Products
          </h2>
          <span className="text-sm text-gray-500">{products.length} items</span>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Price</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Stock</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No products found. Click &quot;Add Product&quot; to create one.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-900">{product.name}</td>
                  <td className="px-6 py-4 text-gray-700">
                    {product.category?.name || 'Uncategorized'}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    NPR {product.price.toFixed(0)}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{product.stockQuantity}</td>
                  <td className="px-6 py-4">
                    {product.isAvailable ? (
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditProduct(product)}
                        className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors text-sm flex items-center gap-1 border border-primary/20"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product._id)}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-colors text-sm border border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Shop Owner Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-xl border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Shop Owner</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateShop}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business License</label>
                  <input
                    type="text"
                    value={formData.businessLicense}
                    onChange={(e) => setFormData({ ...formData, businessLicense: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                    setFormData({
                      name: '',
                      email: '',
                      password: '',
                      phone: '',
                      location: '',
                      shopName: '',
                      businessLicense: '',
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {formLoading ? 'Creating...' : 'Add Shop Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category create modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Add Category</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setCategoryModalOpen(false);
                  setCategoryFormError('');
                  setCategoryName('');
                  setCategoryImage(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {categoryFormError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {categoryFormError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCategoryFormLoading(true);
                setCategoryFormError('');
                try {
                  const formData = new FormData();
                  formData.append('name', categoryName);
                  if (categoryImage) {
                    formData.append('image', categoryImage);
                  }
                  await api.post('/categories', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });
                  setCategoryModalOpen(false);
                  setCategoryName('');
                  setCategoryImage(null);
                  await fetchCategories();
                } catch (error: any) {
                  setCategoryFormError(
                    error.response?.data?.message || 'Failed to create category'
                  );
                } finally {
                  setCategoryFormLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g. Food, Toys, Medicine"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setCategoryImage(file || null);
                  }}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-medium"
                />
                {categoryImage && (
                  <p className="mt-1 text-xs text-gray-500">
                    Selected: {categoryImage.name}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryModalOpen(false);
                    setCategoryFormError('');
                    setCategoryName('');
                    setCategoryImage(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={categoryFormLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-70"
                >
                  {categoryFormLoading ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product create/edit modal */}
      {productFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-xl w-full mx-4 shadow-xl border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setProductFormOpen(false);
                  setEditingProduct(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {productError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {productError}
              </div>
            )}

            <form onSubmit={handleProductSubmit(handleSubmitProduct)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    {...registerProduct('name')}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {productErrors.name && (
                    <p className="mt-1 text-xs text-red-600">{productErrors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (NPR) *
                  </label>
                  <input
                    type="number"
                    {...registerProduct('price')}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {productErrors.price && (
                    <p className="mt-1 text-xs text-red-600">{productErrors.price.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock Quantity *
                  </label>
                  <input
                    type="number"
                    {...registerProduct('stockQuantity')}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {productErrors.stockQuantity && (
                    <p className="mt-1 text-xs text-red-600">
                      {productErrors.stockQuantity.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    {...registerProduct('category')}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {categories.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      No categories found. Please create categories first.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input
                    id="isAvailable"
                    type="checkbox"
                    {...registerProduct('isAvailable')}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="isAvailable" className="text-sm text-gray-700">
                    Active / visible in customer app
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  {...registerProduct('description')}
                  rows={3}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Short description for the product..."
                />
                {productErrors.description && (
                  <p className="mt-1 text-xs text-red-600">
                    {productErrors.description.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Images
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleProductImagesChange}
                  className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                <p className="mt-1 text-xs text-gray-500">
                  You can upload up to 5 images. Existing images will be replaced if you upload new
                  ones while editing.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setProductFormOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={productFormLoading}
                  className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg flex items-center gap-2 disabled:opacity-70"
                >
                  {productFormLoading ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedShop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-xl border border-gray-200">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Shop Owner Details</h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedShop(null);
                }}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Name</label>
                <p className="text-gray-900 font-medium">{selectedShop.name}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Shop Name</label>
                <p className="text-gray-900 font-medium">{selectedShop.shopName || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Email</label>
                <p className="text-gray-900 font-medium">{selectedShop.email}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Phone</label>
                <p className="text-gray-900 font-medium">{selectedShop.phone || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Location</label>
                <p className="text-gray-900 font-medium">{selectedShop.location || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Business License</label>
                <p className="text-gray-900 font-medium">{selectedShop.businessLicense || 'Not provided'}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">Member Since</label>
                <p className="text-gray-900 font-medium">
                  {new Date(selectedShop.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowDetailsModal(false);
                setSelectedShop(null);
              }}
              className="w-full mt-6 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
