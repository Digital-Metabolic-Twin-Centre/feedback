//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const exportRecruitmentExplorerData = (filteredData: any[]) => {
    if (!filteredData || filteredData.length === 0) return;

    // Define columns you want in CSV
    const headers = [
        "id",
        "name",
        "iembase_name",
        "code",
        "gene_symbol",
        "icimd_category",
        "imd_status",
        "number_of_collaborators",
        "recruited_count",
        "recruitment_target",
    ];

    const escapeCSV = (value: unknown) => {
        if (value === null || value === undefined) return "";
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
    };

    const rows = filteredData.map((item) =>
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        headers.map((key) => escapeCSV((item as any)[key])).join(",")
    );

    const csvContent = [
        headers.join(","),
        ...rows
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "iem_filtered_export.csv";
    link.click();

    URL.revokeObjectURL(url);
};
