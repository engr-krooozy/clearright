import logging
from google.adk.tools import google_search


def search_legal_information(query: str, location: str = "") -> str:
    """
    Search for legal information, statutes, tenant rights, consumer protections,
    and legal aid resources. Use this for jurisdiction-specific laws and current regulations.

    Args:
        query: The legal topic or question to search for
        location: Optional country or region to scope the search (e.g., "Nigeria", "United Kingdom", "California USA")

    Returns:
        Relevant legal information from authoritative sources
    """
    if location:
        search_query = f"{query} {location} law statute rights"
    else:
        search_query = f"{query} law rights legal information"

    logging.info(f"Legal search: {search_query}")
    return google_search(search_query)


def get_legal_aid_resources(location: str, issue_type: str = "") -> str:
    """
    Find free legal aid organisations and resources for a given country or region.

    Args:
        location: Country or region (e.g., "Nigeria", "United Kingdom", "Kenya", "California USA")
        issue_type: Type of legal issue (eviction, debt, employment, immigration, etc.)

    Returns:
        List of legal aid resources and contact information
    """
    if issue_type:
        query = f"free legal aid {issue_type} {location} organisation contact"
    else:
        query = f"free legal aid {location} organisation contact"

    logging.info(f"Legal aid resource search: {query}")
    return google_search(query)
