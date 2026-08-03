"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search as SearchIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";

const HAS_WEBSITE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "has", label: "Has Website" },
  { value: "none", label: "No Website" },
] as const;

const SORT_OPTIONS = [
  { value: "opportunityScore", label: "Opportunity Score" },
  { value: "reviewCount", label: "Reviews" },
  { value: "rating", label: "Rating" },
  { value: "createdAt", label: "Newest" },
] as const;

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina",
  "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;

// "United States" first — the default, nationwide option — followed by every
// state so users can still narrow down without needing to know exact spelling.
const LOCATION_SUGGESTIONS = ["United States", ...US_STATES];

const BUSINESS_CATEGORIES = [
  "Restaurants", "Coffee Shops", "Bakeries", "Bars", "Caterers",
  "Dentists", "Chiropractors", "Physical Therapists", "Veterinarians", "Optometrists",
  "Lawyers", "Accountants", "Financial Advisors", "Insurance Agencies", "Mortgage Brokers",
  "Real Estate Agents", "Property Management Companies", "Interior Designers", "Architects",
  "Plumbers", "Electricians", "HVAC Contractors", "Roofing Contractors", "General Contractors",
  "Landscaping Services", "Painters", "Locksmiths", "Pest Control Services", "Cleaning Services",
  "Auto Repair Shops", "Car Dealerships", "Moving Companies",
  "Hair Salons", "Nail Salons", "Spas", "Gyms & Fitness Centers", "Pet Groomers",
  "Photographers", "Marketing Agencies", "Web Design Agencies", "IT Services", "Consultants",
  "Daycare Centers", "Tutoring Services", "Florists",
] as const;

const searchFormSchema = z.object({
  keyword: z.string().min(1, "Enter a category or keyword"),
  location: z.string().min(1, "Enter a city or location"),
  radiusMeters: z.coerce.number().int().positive(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minReviews: z.coerce.number().int().min(0).optional(),
  hasWebsite: z.enum(["any", "has", "none"]),
  sortBy: z.enum(["opportunityScore", "reviewCount", "rating", "createdAt"]),
});

export type SearchFormValues = z.infer<typeof searchFormSchema>;

interface SearchFormProps {
  defaultValues?: Partial<SearchFormValues>;
  onSubmit: (values: SearchFormValues) => void;
  isSearching?: boolean;
}

const DEFAULT_VALUES: SearchFormValues = {
  keyword: "",
  location: "United States",
  radiusMeters: 8000,
  minRating: undefined,
  minReviews: undefined,
  hasWebsite: "any",
  sortBy: "opportunityScore",
};

export function SearchForm({ defaultValues, onSubmit, isSearching }: SearchFormProps) {
  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            control={form.control}
            name="keyword"
            render={({ field }) => (
              <FormItem className="lg:col-span-2">
                <FormLabel>Business Category</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. plumbers, dentists, coffee shops" list="business-categories" {...field} />
                </FormControl>
                <datalist id="business-categories">
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem className="lg:col-span-2">
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="United States, or narrow to a city/state" list="us-states" {...field} />
                </FormControl>
                <datalist id="us-states">
                  {LOCATION_SUGGESTIONS.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="radiusMeters"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Radius (meters)</FormLabel>
                <FormControl>
                  <Input type="number" min={1000} step={1000} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minRating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Rating</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={5} step={0.1} placeholder="Any" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minReviews"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Reviews</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="Any" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hasWebsite"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {HAS_WEBSITE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sortBy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sort By</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={isSearching}>
          <SearchIcon className="size-4" />
          {isSearching ? "Searching..." : "Search"}
        </Button>
      </form>
    </Form>
  );
}
