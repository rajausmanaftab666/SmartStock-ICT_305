import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Product } from "@shared";
import { productsApi } from "../../api/products";
import { Badge } from "../../components/Badge";
import {
  CellNumber,
  CellText,
  DataTable,
  type Column,
  type SortState,
} from "../../components/DataTable";
import { PageHeader } from "../../components/PageHeader";
import { useAuth, useSettings } from "../../hooks/useAuth";
import { useCategories, useSuppliers } from "../../hooks/useLookups";
import { formatMoney } from "../../lib/format";

const PAGE_SIZE = 20;

/**
 * S7 — the main working screen. Search, three filters, four sortable columns,
 * and rows at or below their minimum tinted and badged (BR15).
 */
export function ProductListPage() {
  const { is } = useAuth();
  const settings = useSettings();
  const navigate = useNavigate();

  const canEdit = is("admin", "staff");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [supplierId, setSupplierId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({
    key: "name",
    direction: "asc",
  });

  const categories = useCategories();
  const suppliers = useSuppliers();

  const listQuery = useQuery({
    queryKey: [
      "products",
      { search, categoryId, supplierId, status, page, sort },
    ],
    queryFn: () =>
      productsApi.list({
        search: search || undefined,
        category_id: categoryId,
        supplier_id: supplierId,
        // "Low stock only" is its own filter, not a status value.
        status: status === "low" ? undefined : status,
        low_stock: status === "low",
        page,
        limit: PAGE_SIZE,
        sort: sort.key,
        direction: sort.direction,
      }),
  });

  function resetTo(update: () => void) {
    update();
    setPage(1);
  }

  const columns: Column<Product>[] = [
    {
      key: "sku",
      label: "SKU",
      sortable: true,
      render: (row) => <CellText value={row.sku} mono tone="muted" />,
    },
    {
      key: "name",
      label: "Product",
      sortable: true,
      render: (row) => <CellText value={row.name} strong wrap />,
    },
    {
      key: "category_name",
      label: "Category",
      render: (row) => <CellText value={row.category_name} tone="muted" />,
    },
    {
      key: "supplier_name",
      label: "Supplier",
      render: (row) => <CellText value={row.supplier_name} tone="muted" />,
    },
    {
      key: "unit_price",
      label: "Unit price",
      align: "right",
      sortable: true,
      render: (row) => (
        <CellNumber
          value={formatMoney(row.unit_price, settings.currency_symbol)}
        />
      ),
    },
    {
      key: "quantity_in_stock",
      label: "In stock",
      align: "right",
      sortable: true,
      render: (row) => (
        <CellNumber
          value={row.quantity_in_stock}
          strong
          tone={row.is_low ? "danger" : "default"}
        />
      ),
    },
    {
      key: "min_stock_level",
      label: "Min",
      align: "right",
      render: (row) => <CellNumber value={row.min_stock_level} tone="muted" />,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <Badge tone={row.is_low ? "low" : row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        // subtitle="Every product, its balance and its minimum level. Rows at or below minimum are tinted."
        actions={
          canEdit
            ? [
                {
                  label: "Add product",
                  variant: "primary",
                  onClick: () => navigate("/products/new"),
                },
              ]
            : []
        }
      />

      <DataTable
        title="Products"
        columns={columns}
        rows={listQuery.data?.rows ?? []}
        rowKey={(row) => row.id}
        total={listQuery.data?.total ?? 0}
        page={page}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        sort={sort}
        onSortChange={(next) => resetTo(() => setSort(next))}
        loading={listQuery.isLoading}
        onRowClick={(row) => navigate(`/products/${row.id}`)}
        rowTinted={(row) => row.is_low}
        unit="products"
        search={{
          value: search,
          onChange: (value) => resetTo(() => setSearch(value)),
          placeholder: "Search name or SKU",
        }}
        filters={
          <>
            <select
              className="select select--sm"
              style={{ width: "auto" }}
              value={categoryId}
              aria-label="Category"
              onChange={(event) =>
                resetTo(() => setCategoryId(event.target.value))
              }
            >
              <option value="all">All categories</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              className="select select--sm"
              style={{ width: "auto" }}
              value={supplierId}
              aria-label="Supplier"
              onChange={(event) =>
                resetTo(() => setSupplierId(event.target.value))
              }
            >
              <option value="all">All suppliers</option>
              {(suppliers.data ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            <select
              className="select select--sm"
              style={{ width: "auto" }}
              value={status}
              aria-label="Status"
              onChange={(event) => resetTo(() => setStatus(event.target.value))}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="low">Low stock only</option>
            </select>
          </>
        }
        empty={{
          title: "No products match",
          text: "Clear the search or filters to see the full catalogue.",
        }}
      />
    </>
  );
}
