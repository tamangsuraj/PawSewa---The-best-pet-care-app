'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import Link from 'next/link';

export interface ShopOwnerOption {
  _id: string;
  name: string;
  email: string;
  shopName?: string;
}

export interface CategoryOption {
  _id: string;
  name: string;
  slug: string;
}

export interface AdminProductShape {
  _id: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity: number;
  isAvailable: boolean;
  images?: string[];
  targetPets?: string[];
  tags?: string[];
  category?: { _id: string; name: string; slug: string };
  seller?: { _id: string; name?: string; email?: string; shopName?: string } | string | null;
}

const TARGET_PET_OPTIONS = ['DOG', 'CAT', 'RABBIT', 'BIRD', 'HAMSTER', 'FISH', 'OTHER'] as const;

const productFormSchema = z.object({
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
  sellerId: z.string().min(1, 'Select a shop owner for automated order routing'),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters'),
  isAvailable: z.boolean().default(true),
});

export type AdminProductFormValues = z.infer<typeof productFormSchema>;

interface AdminProductFormProps {
  mode: 'create' | 'edit';
  initialProduct?: AdminProductShape | null;
  shopOwners: ShopOwnerOption[];
  categories: CategoryOption[];
  onSuccess: () => void;
  cancelHref: string;
}

export function AdminProductForm({
  mode,
  initialProduct,
  shopOwners,
  categories,
  onSuccess,
  cancelHref,
}: AdminProductFormProps) {
  const [productError, setProductError] = useState('');
  const [productFormLoading, setProductFormLoading] = useState(false);
  const [images, setImages] = useState<FileList | null>(null);
  const [targetPetSelection, setTargetPetSelection] = useState<string[]>([]);
  const [universalProduct, setUniversalProduct] = useState(true);
  const [productTags, setProductTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminProductFormValues>({
    resolver: zodResolver(productFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      price: '',
      stockQuantity: '',
      category: '',
      sellerId: '',
      isAvailable: true,
    },
  });

  useEffect(() => {
    if (!initialProduct || mode !== 'edit') return;
    const tp = Array.isArray(initialProduct.targetPets)
      ? initialProduct.targetPets.map((t) => String(t).toUpperCase())
      : [];
    const isUniversal = tp.length === 0;
    const sid =
      typeof initialProduct.seller === 'object' && initialProduct.seller && '_id' in initialProduct.seller
        ? String((initialProduct.seller as { _id: string })._id)
        : initialProduct.seller
          ? String(initialProduct.seller)
          : '';
    reset({
      name: initialProduct.name,
      description: initialProduct.description || '',
      price: initialProduct.price.toString(),
      stockQuantity: initialProduct.stockQuantity.toString(),
      category: initialProduct.category?._id || '',
      sellerId: sid,
      isAvailable: initialProduct.isAvailable,
    });
    setUniversalProduct(isUniversal);
    setTargetPetSelection(isUniversal ? [] : tp);
    setProductTags(Array.isArray(initialProduct.tags) ? initialProduct.tags : []);
    setTagDraft('');
    setImages(null);
    setProductError('');
  }, [initialProduct, mode, reset]);

  useEffect(() => {
    if (mode !== 'create' || categories.length === 0) return;
    reset((prev) => ({
      ...prev,
      category: prev.category || categories[0]._id,
    }));
  }, [mode, categories, reset]);

  const onSubmit = async (values: AdminProductFormValues) => {
    if (!universalProduct && targetPetSelection.length === 0) {
      setProductError('Select at least one target pet type, or mark the product as Universal.');
      return;
    }
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
      if (values.sellerId) {
        formData.append('seller', values.sellerId);
      }
      if (universalProduct) {
        formData.append('targetPetsUniversal', 'true');
      } else {
        formData.append('targetPets', JSON.stringify(targetPetSelection));
      }
      formData.append('tags', JSON.stringify(productTags.length ? productTags : []));
      if (images && images.length > 0) {
        Array.from(images).forEach((file) => {
          formData.append('images', file);
        });
      }

      if (mode === 'edit' && initialProduct) {
        await api.patch(`/products/${initialProduct._id}`, formData);
      } else {
        await api.post('/products', formData);
      }
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setProductError(e.response?.data?.message || 'Failed to save product');
    } finally {
      setProductFormLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'edit' ? 'Edit product' : 'Add new product'}
        </h1>
        <Link
          href={cancelHref}
          className="text-sm font-medium text-primary hover:underline"
        >
          Back to catalogue
        </Link>
      </div>

      {productError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {productError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shop owner (seller) *
            </label>
            <select
              {...register('sellerId')}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select shop owner</option>
              {shopOwners.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.shopName ? `${s.shopName} (${s.name})` : s.name} — {s.email}
                </option>
              ))}
            </select>
            {errors.sellerId && (
              <p className="mt-1 text-xs text-red-600">{errors.sellerId.message}</p>
            )}
            {shopOwners.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                No shop owners found. Provision a shop owner under Partner Management first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              {...register('name')}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price (NPR) *</label>
            <input
              type="number"
              {...register('price')}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {errors.price && (
              <p className="mt-1 text-xs text-red-600">{errors.price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stock quantity *</label>
            <input
              type="number"
              {...register('stockQuantity')}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {errors.stockQuantity && (
              <p className="mt-1 text-xs text-red-600">{errors.stockQuantity.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
            <select
              {...register('category')}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>
            )}
            {categories.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Create categories under Shop Management first.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="isAvailable"
              type="checkbox"
              {...register('isAvailable', { valueAsBoolean: true })}
              className="h-4 w-4 text-primary border-gray-300 rounded"
            />
            <label htmlFor="isAvailable" className="text-sm text-gray-700">
              Active / visible in customer app
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={universalProduct}
              onChange={(e) => {
                setUniversalProduct(e.target.checked);
                if (e.target.checked) setTargetPetSelection([]);
              }}
              className="h-4 w-4 rounded border-gray-300 text-primary"
            />
            <span className="text-sm font-medium text-gray-800">Universal (all pet types)</span>
          </label>
          {!universalProduct && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Target pet type
              </p>
              <div className="flex flex-wrap gap-2">
                {TARGET_PET_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={targetPetSelection.includes(opt)}
                      onChange={() => {
                        setTargetPetSelection((prev) =>
                          prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
                        );
                      }}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Tags</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {productTags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                >
                  {t}
                  <button
                    type="button"
                    className="font-bold leading-none text-primary"
                    onClick={() => setProductTags((prev) => prev.filter((x) => x !== t))}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = tagDraft.trim();
                    if (v && !productTags.includes(v)) {
                      setProductTags((prev) => [...prev, v].slice(0, 24));
                      setTagDraft('');
                    }
                  }
                }}
                placeholder="Type a tag and press Enter"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
              <button
                type="button"
                className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-300"
                onClick={() => {
                  const v = tagDraft.trim();
                  if (v && !productTags.includes(v)) {
                    setProductTags((prev) => [...prev, v].slice(0, 24));
                    setTagDraft('');
                  }
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="Short description for the product"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Images</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImages(e.target.files)}
            className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
          <p className="mt-1 text-xs text-gray-500">
            Up to 5 images. Uploading new files while editing replaces existing images.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href={cancelHref}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={productFormLoading}
            className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-70"
          >
            {productFormLoading ? 'Saving...' : mode === 'edit' ? 'Update product' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  );
}
